"""Route/Firestore/Storage contract tests. Doubles do not prove cloud billing or IAM."""

import asyncio
import hashlib
import io
import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from google.api_core.exceptions import PreconditionFailed
from PIL import Image
from pypdf import PdfWriter
from starlette.datastructures import Headers, UploadFile
from test_profiles import FirestoreDouble, Ref, Snapshot, TestVerifier, bootstrap, headers

from kiki_api.backend import BoundaryError, FirestoreProfiles, Services
from kiki_api.config import Settings
from kiki_api.main import create_app
from kiki_api.material_files import inspect_file
from kiki_api.material_models import MAX_BODY_BYTES, MAX_FILE_BYTES
from kiki_api.material_routes import UploadBodyLimit
from kiki_api.materials import FirestoreMaterials, MaterialLibrary, PrivateOriginals


class QueryDouble:
    def __init__(self, ref):
        self.ref, self.cursor, self.count = ref, None, 100

    def start_after(self, snapshot):
        self.cursor = snapshot.data["id"]
        return self

    def limit(self, count):
        self.count = count
        return self

    def stream(self, timeout):
        prefix = self.ref.path + "/"
        records = [
            data
            for path, data in self.ref.client.docs.items()
            if path.startswith(prefix) and "/" not in path[len(prefix) :]
        ]
        records.sort(key=lambda data: (data["createdAt"], data["id"]), reverse=True)
        if self.cursor:
            position = next(i for i, row in enumerate(records) if row["id"] == self.cursor)
            records = records[position + 1 :]
        return iter(Snapshot(row) for row in records[: self.count])


class BucketDouble:
    def __init__(self):
        self.objects, self.writes, self.fail_after_write = {}, 0, False

    def blob(self, name, generation=None):
        return BlobDouble(self, name, generation)


class BlobDouble:
    def __init__(self, bucket, name, generation):
        self.bucket, self.name, self.generation = bucket, name, generation
        self.metadata, self.cache_control = None, None

    def upload_from_file(
        self, stream, *, size, content_type, if_generation_match, checksum, timeout
    ):
        assert if_generation_match == 0 and checksum == "crc32c"
        if self.name in self.bucket.objects:
            raise PreconditionFailed("exists")
        self.bucket.writes += 1
        self.generation = self.bucket.writes
        data = stream.read()
        assert len(data) == size
        self.bucket.objects[self.name] = {
            "data": data,
            "size": size,
            "content_type": content_type,
            "metadata": deepcopy(self.metadata),
            "generation": self.generation,
        }
        if self.bucket.fail_after_write:
            self.bucket.fail_after_write = False
            raise RuntimeError("private-storage-error")

    def reload(self, timeout):
        saved = self.bucket.objects[self.name]
        if self.generation:
            assert self.generation == saved["generation"]
        for field in ["size", "content_type", "metadata", "generation"]:
            setattr(self, field, saved[field])

    def download_as_bytes(self, *, if_generation_match, checksum, timeout):
        saved = self.bucket.objects[self.name]
        assert if_generation_match == saved["generation"] and checksum == "crc32c"
        return saved["data"]


@pytest.fixture
def material_harness(monkeypatch):
    monkeypatch.setattr("kiki_api.materials.firestore.transactional", lambda fn: fn)
    monkeypatch.setattr(Ref, "order_by", lambda ref, *a, **k: QueryDouble(ref), raising=False)
    store, bucket = FirestoreDouble(), BucketDouble()
    library = MaterialLibrary(FirestoreMaterials(store), PrivateOriginals(bucket))
    services = Services(TestVerifier(), FirestoreProfiles(store), library)
    config = Settings(_env_file=None, firebase_project_id="unit-test-project")
    client = TestClient(create_app(config, lambda: services), raise_server_exceptions=False)
    for user in ["a", "b"]:
        bootstrap(client, user)
        client.post(
            "/learners/me/enrollments",
            headers=headers(user),
            json={
                "courseId": "CRS-AC-ECE",
                "semester": 5,
            },
        )
    return client, store, bucket, library


def pdf():
    writer, stream = PdfWriter(), io.BytesIO()
    writer.add_blank_page(width=100, height=100)
    writer.write(stream)
    return stream.getvalue()


def image(format="PNG"):
    stream = io.BytesIO()
    Image.new("RGB", (2, 2), "white").save(stream, format=format)
    return stream.getvalue()


def upload(client, key="upload-key-01", user="a", context=None, files=None):
    return client.post(
        "/study-requests",
        headers={**headers(user), "Idempotency-Key": key},
        data={
            "context": json.dumps(
                context
                if context is not None
                else {
                    "courseId": "CRS-AC-ECE",
                    "kind": "notes",
                    "topic": "Analog Modulation",
                    "note": "Taught today",
                    "classDate": "2026-10-15",
                }
            )
        },
        files=files if files is not None else [("files", ("notes.pdf", pdf(), "application/pdf"))],
    )


def test_upload_reopen_private_original_download_and_no_learning_evidence(material_harness):
    client, store, bucket, _ = material_harness
    profile = client.get("/learners/me/profile", headers=headers()).json()
    original = image()
    response = upload(client, files=[("files", ("ଓଡ଼ିଆ.png", original, "image/png"))])
    assert response.status_code == 200, response.text
    receipt = response.json()["request"]
    assert receipt["status"] == "stored" and receipt["outline"] is None
    assert receipt["failure"] is None and receipt["lessonPlanId"] is None
    source = receipt["sources"][0]
    assert source["sha256"] == hashlib.sha256(original).hexdigest()
    assert "generation" not in source and "storagePath" not in source
    listed = client.get("/study-requests", headers=headers()).json()
    assert listed == {"requests": [receipt], "nextCursor": None}
    assert (
        client.get("/study-requests/" + receipt["id"], headers=headers()).json()["request"]
        == receipt
    )
    url = "/source-docs/" + source["id"]
    assert client.get(url, headers=headers()).json()["source"] == source
    content = client.get(url + "/content", headers=headers())
    assert content.content == original and content.headers["content-type"] == "image/png"
    assert content.headers["cache-control"] == "private, no-store"
    assert content.headers["content-disposition"].startswith("attachment; filename*=UTF-8''")
    assert client.get("/learners/me/profile", headers=headers()).json() == profile
    job = store.docs["learners/a/intakeJobs/" + receipt["jobId"]]
    assert job["status"] == "waiting_for_processor"
    assert bucket.writes == 1


def test_every_material_endpoint_checks_identity_and_owner(material_harness):
    client, _, _, _ = material_harness
    receipt = upload(client).json()["request"]
    paths = ["/study-requests/" + receipt["id"], "/source-docs/" + receipt["sources"][0]["id"]]
    paths.append(paths[-1] + "/content")
    for path in paths:
        assert client.get(path).status_code == 401
        assert client.get(path, headers=headers("b")).status_code == 404
    assert client.get("/study-requests", headers=headers("b")).json()["requests"] == []
    for suffix in ["/confirm", "/retry"]:
        assert client.post(paths[0] + suffix, headers=headers("b"), json={}).status_code == 404
        assert client.post(paths[0] + suffix, headers=headers(), json={}).status_code == 409
    assert client.post("/study-requests").status_code == 401
    assert client.get("/source-docs/a%2Fb", headers=headers()).status_code == 404


def test_repeat_safe_upload_rejects_changed_payload_and_keys_are_owner_scoped(material_harness):
    client, _, bucket, _ = material_harness
    original = upload(client).json()
    assert upload(client).json() == original and bucket.writes == 1
    assert (
        upload(client, files=[("files", ("other.pdf", pdf(), "application/pdf"))]).status_code
        == 409
    )
    other = upload(client, user="b").json()["request"]
    assert other["id"] != original["request"]["id"] and bucket.writes == 2
    assert upload(client, key="../unsafe-key").status_code == 422


def test_uncertain_storage_write_and_metadata_commit_resume_without_duplicate_receipt(
    material_harness, monkeypatch
):
    client, store, bucket, library = material_harness
    bucket.fail_after_write = True
    response = upload(client)
    assert response.status_code == 503 and "private-storage-error" not in response.text
    assert client.get("/study-requests", headers=headers()).json()["requests"] == []
    assert len(bucket.objects) == 1
    real_commit = library.records.commit
    monkeypatch.setattr(library.records, "commit", lambda *a: (_ for _ in ()).throw(RuntimeError()))
    assert upload(client).status_code == 503
    monkeypatch.setattr(library.records, "commit", real_commit)
    receipt = upload(client).json()["request"]
    assert receipt["status"] == "stored" and bucket.writes == 1
    assert len([key for key in store.docs if "/studyRequests/" in key]) == 1


def test_retry_after_lost_receipt_returns_committed_request(material_harness, monkeypatch):
    client, _, bucket, library = material_harness
    real_commit = library.records.commit

    def commit_then_fail(*args):
        real_commit(*args)
        raise RuntimeError("lost response")

    monkeypatch.setattr(library.records, "commit", commit_then_fail)
    assert upload(client).status_code == 503
    monkeypatch.setattr(library.records, "commit", real_commit)
    assert upload(client).status_code == 200 and bucket.writes == 1


@pytest.mark.parametrize(
    "context",
    [
        {"courseId": "other", "kind": "notes", "topic": "Test"},
        {"courseId": "CRS-AC-ECE", "kind": "notes", "topic": "   "},
        {"courseId": "CRS-AC-ECE", "kind": "notes", "topic": "Test", "classDate": "2026-02-30"},
        {"courseId": "CRS-AC-ECE", "kind": "notes", "topic": "Test", "ownerLearnerId": "b"},
        {"courseId": "CRS-AC-ECE", "kind": "notes", "topic": "Test", "status": "ready"},
    ],
)
def test_invalid_or_forged_context_never_reserves_or_uploads(material_harness, context):
    client, store, bucket, _ = material_harness
    assert upload(client, context=context).status_code == 422
    assert not bucket.objects and not any("uploadOperations" in path for path in store.docs)


@pytest.mark.parametrize(
    "name,data,mime,status",
    [
        ("bad.pdf", b"%PDF-1.4 fake document", "application/pdf", 422),
        ("bad.png", b"\x89PNG\r\n\x1a\ninvalid", "image/png", 422),
        ("bad.png", image("JPEG"), "image/png", 422),
        ("empty.pdf", b"", "application/pdf", 422),
        ("large.pdf", b"%PDF-" + b"a" * MAX_FILE_BYTES, "application/pdf", 413),
        ("text.txt", b"text", "text/plain", 422),
    ],
    # Short ids: pytest puts the id in PYTEST_CURRENT_TEST; Windows caps env vars at 32,767 chars.
    ids=["fake-pdf", "invalid-png", "jpeg-as-png", "empty-pdf", "large-pdf", "text"],
)
def test_invalid_originals_never_commit_receipts(material_harness, name, data, mime, status):
    client, store, bucket, _ = material_harness
    assert upload(client, files=[("files", (name, data, mime))]).status_code == status
    assert not bucket.objects and not any("studyRequests" in path for path in store.docs)


def test_pdf_encryption_and_image_pixel_limits():
    writer, stream = PdfWriter(), io.BytesIO()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("secret")
    writer.write(stream)
    encrypted = UploadFile(
        io.BytesIO(stream.getvalue()),
        filename="locked.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )
    with pytest.raises(BoundaryError):
        inspect_file(encrypted)
    oversized = io.BytesIO()
    Image.new("1", (6400, 6400)).save(oversized, format="PNG")
    upload_file = UploadFile(
        io.BytesIO(oversized.getvalue()),
        filename="huge.png",
        headers=Headers({"content-type": "image/png"}),
    )
    with pytest.raises(BoundaryError):
        inspect_file(upload_file)


def test_file_count_enrollment_and_unconfigured_storage_fail_honestly(material_harness):
    client, store, bucket, library = material_harness
    assert (
        upload(client, files=[("files", ("notes.pdf", pdf(), "application/pdf"))] * 6).status_code
        == 422
    )
    store.docs["learners/a"]["courseIds"] = []
    assert upload(client).status_code == 409
    store.docs["learners/a"]["courseIds"] = ["CRS-AC-ECE"]
    library.originals = None
    response = upload(client)
    assert response.status_code == 503 and "storage is not configured" in response.text
    assert not bucket.objects


def test_paginated_library_has_stable_cursor_and_no_cross_owner_rows(material_harness):
    client, _, _, _ = material_harness
    for key in ["upload-key-01", "upload-key-02", "upload-key-03"]:
        assert upload(client, key=key).status_code == 200
    first = client.get("/study-requests?page_size=2", headers=headers()).json()
    assert len(first["requests"]) == 2 and first["nextCursor"]
    second = client.get(
        "/study-requests?page_size=2&cursor=" + first["nextCursor"], headers=headers()
    ).json()
    assert len(second["requests"]) == 1 and second["nextCursor"] is None
    assert len({r["id"] for r in first["requests"] + second["requests"]}) == 3
    assert (
        client.get(
            "/study-requests?cursor=" + first["nextCursor"], headers=headers("b")
        ).status_code
        == 422
    )


def test_corrupted_original_is_never_delivered(material_harness):
    client, _, bucket, _ = material_harness
    receipt = upload(client).json()["request"]
    blob = next(iter(bucket.objects.values()))
    blob["data"] = b"x" * len(blob["data"])
    response = client.get(
        "/source-docs/" + receipt["sources"][0]["id"] + "/content", headers=headers()
    )
    assert response.status_code == 503


def test_actual_body_limit_handles_chunked_upload_without_content_length():
    async def exercise():
        sent, chunks = [], [b"a" * (MAX_BODY_BYTES // 2 + 1)] * 2

        async def receive():
            return {"type": "http.request", "body": chunks.pop(), "more_body": bool(chunks)}

        async def consuming_app(scope, read, send):
            await read()
            await read()

        await UploadBodyLimit(consuming_app)(
            {"type": "http", "path": "/study-requests", "method": "POST", "headers": []},
            receive,
            async_send(sent),
        )
        assert sent[0]["status"] == 413

    asyncio.run(exercise())


def async_send(messages):
    async def send(message):
        messages.append(message)

    return send


def test_partial_multi_file_upload_is_invisible_until_every_original_is_stored(
    material_harness, monkeypatch
):
    client, _, bucket, library = material_harness
    real_put = library.originals.put

    def put_with_failure(uid, source, original):
        if source.id.endswith("-1"):
            raise RuntimeError("second object unavailable")
        return real_put(uid, source, original)

    files = [
        ("files", ("notes.pdf", pdf(), "application/pdf")),
        ("files", ("diagram.png", image(), "image/png")),
    ]
    monkeypatch.setattr(library.originals, "put", put_with_failure)
    assert upload(client, files=files).status_code == 503
    assert len(bucket.objects) == 1
    assert client.get("/study-requests", headers=headers()).json()["requests"] == []
    monkeypatch.setattr(library.originals, "put", real_put)
    recovered = upload(client, files=files)
    assert recovered.status_code == 200
    assert len(recovered.json()["request"]["sources"]) == 2 and bucket.writes == 2


def test_conflicting_partial_original_is_never_overwritten(material_harness):
    client, _, bucket, _ = material_harness
    bucket.fail_after_write = True
    assert upload(client).status_code == 503
    existing = next(iter(bucket.objects.values()))
    existing["metadata"]["sha256"] = "0" * 64
    assert upload(client).status_code == 409
    assert bucket.writes == 1
    assert client.get("/study-requests", headers=headers()).json()["requests"] == []
