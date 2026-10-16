"""UID-owned receipts and private original objects with recoverable cross-service writes."""

import hashlib
import json
import re
from datetime import UTC, datetime

from firebase_admin import firestore
from google.api_core.exceptions import PreconditionFailed
from pydantic import ValidationError

from .backend import BoundaryError
from .material_files import InspectedFile
from .material_models import IntakeContext, RequestsEnvelope, SourceAsset, StoredRequest


def valid_id(value: str):
    if not re.fullmatch(r"[a-f0-9]{64}(?:-[0-4])?", value):
        raise BoundaryError(404, "This material could not be found.")
    return value


def public_request(data, uid) -> StoredRequest:
    try:
        record = StoredRequest.model_validate(data)
        if record.ownerLearnerId != uid or any(
            source.ownerLearnerId != uid or source.requestId != record.id
            for source in record.sources
        ):
            raise ValueError("Owner mismatch")
        return record
    except (ValueError, ValidationError):
        raise BoundaryError(503, "This material record needs a compatibility check.") from None


class FirestoreMaterials:
    def __init__(self, client):
        self.client = client

    def collection(self, uid, name):
        return self.client.collection("learners").document(uid).collection(name)

    def get(self, uid, request_id):
        snapshot = (
            self.collection(uid, "studyRequests").document(valid_id(request_id)).get(timeout=5)
        )
        if not snapshot.exists:
            raise BoundaryError(404, "This material could not be found.")
        record = public_request(snapshot.to_dict(), uid)
        if record.id != request_id:
            raise BoundaryError(503, "This material record needs a compatibility check.")
        return record

    def source(self, uid, source_id):
        snapshot = self.collection(uid, "sourceDocs").document(valid_id(source_id)).get(timeout=5)
        if not snapshot.exists:
            raise BoundaryError(404, "This original could not be found.")
        data = snapshot.to_dict()
        source = SourceAsset.model_validate({k: v for k, v in data.items() if k != "generation"})
        if source.ownerLearnerId != uid or source.id != source_id:
            raise BoundaryError(503, "This original record needs a compatibility check.")
        parent = self.get(uid, source.requestId)
        if source not in parent.sources:
            raise BoundaryError(503, "This original does not match its saved request.")
        return source, data["generation"]

    def list(self, uid, cursor=None, page_size=25):
        query = self.collection(uid, "studyRequests").order_by(
            "createdAt", direction=firestore.Query.DESCENDING
        )
        if cursor:
            snapshot = (
                self.collection(uid, "studyRequests").document(valid_id(cursor)).get(timeout=5)
            )
            if not snapshot.exists:
                raise BoundaryError(422, "Refresh Library to start a new page.")
            query = query.start_after(snapshot)
        rows = list(query.limit(page_size + 1).stream(timeout=10))
        records = [public_request(row.to_dict(), uid) for row in rows[:page_size]]
        return RequestsEnvelope(
            requests=records,
            nextCursor=records[-1].id if len(rows) > page_size else None,
        )

    def reserve(self, uid, request_id, fingerprint):
        operation = self.collection(uid, "uploadOperations").document(request_id)
        receipt = self.collection(uid, "studyRequests").document(request_id)

        @firestore.transactional
        def apply(transaction):
            existing = operation.get(transaction=transaction, timeout=5)
            saved = receipt.get(transaction=transaction, timeout=5)
            if existing.exists:
                data = existing.to_dict()
                if data["fingerprint"] != fingerprint:
                    raise BoundaryError(
                        409, "This upload key was used with different files or details."
                    )
                return data["createdAt"], public_request(
                    saved.to_dict(), uid
                ) if saved.exists else None
            created_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
            transaction.create(
                operation,
                {"fingerprint": fingerprint, "createdAt": created_at, "status": "receiving"},
            )
            return created_at, None

        return apply(self.client.transaction(max_attempts=3))

    def commit(self, uid, receipt, generations, fingerprint):
        operation = self.collection(uid, "uploadOperations").document(receipt.id)
        ref = self.collection(uid, "studyRequests").document(receipt.id)

        @firestore.transactional
        def apply(transaction):
            ticket = operation.get(transaction=transaction, timeout=5)
            saved = ref.get(transaction=transaction, timeout=5)
            if not ticket.exists or ticket.to_dict()["fingerprint"] != fingerprint:
                raise BoundaryError(
                    409, "The upload reservation does not match. Retry your upload."
                )
            if saved.exists:
                return public_request(saved.to_dict(), uid)
            transaction.create(ref, receipt.model_dump(by_alias=True))
            for source, generation in zip(receipt.sources, generations, strict=True):
                transaction.create(
                    self.collection(uid, "sourceDocs").document(source.id),
                    {**source.model_dump(), "generation": generation},
                )
            transaction.create(
                self.collection(uid, "intakeJobs").document(receipt.jobId),
                {
                    "requestId": receipt.id,
                    "ownerLearnerId": uid,
                    "status": "waiting_for_processor",
                    "createdAt": receipt.createdAt,
                },
            )
            transaction.update(operation, {"status": "stored"})
            return receipt

        return apply(self.client.transaction(max_attempts=3))


class PrivateOriginals:
    def __init__(self, bucket):
        self.bucket = bucket

    @staticmethod
    def path(uid, source):
        return f"learners/{uid}/requests/{source.requestId}/{source.id}"

    @staticmethod
    def matching(blob, source):
        return (
            blob.size == source.size
            and blob.content_type == source.mime
            and (blob.metadata or {}).get("sha256") == source.sha256
        )

    def put(self, uid, source, original):
        blob = self.bucket.blob(self.path(uid, source))
        blob.metadata = {"sha256": source.sha256}
        blob.cache_control = "private, no-store"
        # Create only. Never overwrite a student's original, including concurrent retries.
        try:
            original.stream.seek(0)
            blob.upload_from_file(
                original.stream,
                size=source.size,
                content_type=source.mime,
                if_generation_match=0,
                checksum="crc32c",
                timeout=20,
            )
        except PreconditionFailed:
            blob.reload(timeout=10)
            if not self.matching(blob, source):
                raise BoundaryError(
                    409, "An existing original does not match this upload."
                ) from None
        return str(blob.generation)

    def read(self, uid, source, generation):
        blob = self.bucket.blob(self.path(uid, source), generation=int(generation))
        blob.reload(timeout=10)
        if not self.matching(blob, source):
            raise BoundaryError(503, "The original file does not match its saved record.")
        content = blob.download_as_bytes(
            if_generation_match=int(generation), checksum="crc32c", timeout=20
        )
        if len(content) != source.size or hashlib.sha256(content).hexdigest() != source.sha256:
            raise BoundaryError(503, "The original file could not be verified. Please retry.")
        return content


class MaterialLibrary:
    def __init__(self, records, originals):
        self.records, self.originals = records, originals

    def create(self, uid: str, context: IntakeContext, files: list[InspectedFile], key: str):
        if not re.fullmatch(r"[A-Za-z0-9_-]{8,200}", key):
            raise BoundaryError(
                422, "Provide an upload operation key between 8 and 200 characters."
            )
        if not self.originals:
            raise BoundaryError(
                503, "Cloud file storage is not configured yet. Your files were not uploaded."
            )
        request_id = hashlib.sha256(json.dumps([uid, key]).encode()).hexdigest()
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "context": context.model_dump(),
                    "files": [[file.title, file.mime, file.size, file.sha256] for file in files],
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()
        created_at, saved = self.records.reserve(uid, request_id, fingerprint)
        if saved:
            return saved
        sources, generations = [], []
        for index, original in enumerate(files):
            source = SourceAsset(
                id=f"{request_id}-{index}",
                requestId=request_id,
                ownerLearnerId=uid,
                title=original.title,
                mime=original.mime,
                size=original.size,
                sha256=original.sha256,
                createdAt=created_at,
            )
            generations.append(self.originals.put(uid, source, original))
            sources.append(source)
        receipt = StoredRequest(
            **context.model_dump(),
            id=request_id,
            ownerLearnerId=uid,
            sources=sources,
            jobId=request_id,
            createdAt=created_at,
            updatedAt=created_at,
        )
        return self.records.commit(uid, receipt, generations, fingerprint)

    def content(self, uid, source_id):
        source, generation = self.records.source(uid, source_id)
        if not self.originals:
            raise BoundaryError(503, "Cloud file storage is not configured yet.")
        return source, self.originals.read(uid, source, generation)
