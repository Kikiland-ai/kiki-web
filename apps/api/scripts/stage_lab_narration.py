"""Validate and stage the immutable DSB-SC narration package in private media storage."""

import argparse
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from google.cloud import storage

from kiki_api.concept_media import BucketMediaAssets
from kiki_api.lab_narration import MIME, PRACTICAL, SHA256, release, storage_prefix


def digest(data):
    return hashlib.sha256(data).hexdigest()


def package(directory):
    manifest_bytes = (directory / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    entries = manifest["entries"]
    revision = digest(json.dumps(entries, ensure_ascii=False, sort_keys=True).encode())
    if (
        manifest["schema"] != "lab-step-narration-manifest/v1"
        or manifest["experiment_id"] != PRACTICAL
        or manifest["manifest_revision"] != revision
        or len(entries) != manifest["total_actions"]
    ):
        raise ValueError("Unexpected or inconsistent lab narration manifest")
    index = {
        "schema": "lab-narration/v1",
        "experimentId": PRACTICAL,
        "procedureVersion": manifest["procedure_version"],
        "profileId": manifest["profile_id"],
        "revision": revision,
        "clips": {},
    }
    prefix = storage_prefix(revision)
    audio = {}
    for entry in entries:
        action_id = entry["action_id"]
        asset = entry["asset"]
        asset_id = asset["asset_id"]
        relative = f"assets/{asset_id}.wav"
        if (
            entry["status"] != "generated"
            or entry["experiment_id"] != PRACTICAL
            or entry["procedure_version"] != index["procedureVersion"]
            or entry["profile_id"] != index["profileId"]
            or entry["instruction_variant"] != "instruction"
            or entry["verification_only"]
            or not re.fullmatch(r"CP-DSB-\d{2}/[a-z0-9-]+", action_id)
            or action_id in index["clips"]
            or not re.fullmatch(SHA256, asset_id)
            or asset["path"] != relative
            or asset["mime_type"] != MIME
        ):
            raise ValueError("A narration binding is invalid")
        data = (directory / relative).read_bytes()
        if len(data) != asset["bytes"] or digest(data) != asset_id:
            raise ValueError(f"Clip integrity failed for {action_id}")
        index["clips"][action_id] = {"assetId": asset_id, "bytes": len(data)}
        audio[f"{prefix}/{relative}"] = (data, MIME, asset_id)
    provenance = (
        f"{prefix}/manifest.json", manifest_bytes, "application/json", digest(manifest_bytes)
    )
    return index, audio, provenance


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    operation = parser.add_mutually_exclusive_group()
    operation.add_argument("--write-index", type=Path)
    operation.add_argument("--bucket")
    parser.add_argument("--project")
    args = parser.parse_args()
    index, audio, manifest = package(args.directory)
    if args.write_index:
        args.write_index.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    elif args.bucket:
        if index != release():
            raise ValueError("The bundle does not match the API's pinned index")
        bucket = storage.Client(project=args.project).bucket(args.bucket)
        bucket.reload(timeout=15)
        if (
            not bucket.iam_configuration.uniform_bucket_level_access_enabled
            or bucket.iam_configuration.public_access_prevention != "enforced"
        ):
            raise ValueError("Narration requires a private, uniform-access media bucket")
        assets = BucketMediaAssets(bucket)

        def upload(entry):
            path, data, mime, sha = entry
            assets.put(path, data, mime, sha)
            assets.read(path, mime, len(data), sha)

        with ThreadPoolExecutor(max_workers=4) as workers:
            list(workers.map(upload, [(path, *asset) for path, asset in audio.items()]))
        upload(manifest)
        print(f"Staged and verified {len(audio)} clips and the manifest in gs://{args.bucket}/{storage_prefix(index['revision'])}")
    else:
        print(f"Verified {len(index['clips'])} bindings for revision {index['revision']}")


if __name__ == "__main__":
    main()
