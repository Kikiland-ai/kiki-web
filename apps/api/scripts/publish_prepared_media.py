"""Validate existing v1 packages, then publish to the explicitly selected named database.

No generation or learner writes. --apply requires the exact dry-run plan SHA256.
Each assets-dir entry is named by its SHA256 (no extension).
"""

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

from kiki_api.concept_media import (
    BucketMediaAssets,
    MediaPackage,
    bind,
    decode_record,
    head_path,
    publish,
)
from kiki_api.learning_catalog import build_catalog, digest, import_catalog
from kiki_api.learning_models import PLAN, Lesson
from kiki_api.media_models import MediaManifest


def prepare(packages_dir: Path, assets_dir: Path, root: Path):
    catalog = build_catalog(
        root / "data-model/ledgers/electronics/analog-modulation.json",
        root / "data-model/cases/analog-modulation-odia.json",
    )
    packages = []
    for number in range(1, 11):
        cid = f"C-AM-{number:02}"
        record = json.loads((packages_dir / f"{cid}.json").read_text(encoding="utf-8"))
        manifest = MediaManifest.model_validate(record["manifest"])
        base = f"learningCatalog/{PLAN}/versions/{catalog.version}"
        lesson = Lesson.model_validate(catalog.documents[f"{base}/lessons/{cid}"])
        source = catalog.documents[f"{base}/sourceConcepts/{cid}"]
        if (
            record["schema"] != "concept-media-revision/v1"
            or manifest.catalogVersion != catalog.version
        ):
            raise ValueError("Package identity differs from authored catalog")
        bind(manifest, lesson, source)
        if cid == "C-AM-08" and manifest.mediaRevision != "cm-e0f086007cc9f2062af093f3":
            raise ValueError("Native bilingual C08 revision must be preserved")
        if set(record["assets"]) != {r.assetId for r in manifest.narration}:
            raise ValueError("Asset index differs from narration")
        assets = {}
        for clip in manifest.narration:
            content = (assets_dir / clip.assetId).read_bytes()
            if hashlib.sha256(content).hexdigest() != clip.assetId or len(content) != clip.bytes:
                raise ValueError("Original recording differs from manifest")
            expected = {
                "path": f"concept-media/{PLAN}/assets/sha256/{clip.assetId}",
                "mimeType": "audio/wav",
                "bytes": clip.bytes,
            }
            if record["assets"][clip.assetId] != expected:
                raise ValueError("Invalid private asset path")
            assets[clip.assetId] = content
        packages.append(MediaPackage(manifest, record, assets))
    if sum(len(p.manifest.narration) for p in packages) != 26:
        raise ValueError("All 26 original recordings are required")
    return catalog, packages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packages-dir", type=Path, required=True)
    parser.add_argument("--assets-dir", type=Path, required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--plan-sha256")
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--gcloud-account", choices=["arpanvihan5@gmail.com"])
    args = parser.parse_args()
    if (args.project, args.database, args.bucket) != (
        "kiki-512012",
        "kiki-firedb",
        "kiki-web-bucket",
    ):
        raise ValueError("This release publisher is scoped to the reviewed KiKi targets")
    root = Path(__file__).resolve().parents[3]
    catalog, packages = prepare(args.packages_dir, args.assets_dir, root)
    plan = {
        "project": args.project,
        "database": args.database,
        "bucket": args.bucket,
        "catalogVersion": catalog.version,
        "catalogHash": catalog.manifest["payloadHash"],
        "catalogDocuments": len(catalog.documents),
        "recordings": 26,
        "concepts": [
            {
                "conceptId": p.manifest.conceptId,
                "mediaRevision": p.manifest.mediaRevision,
                "recordHash": digest(p.record),
                "assets": p.record["assets"],
            }
            for p in packages
        ],
    }
    plan_hash = digest(plan)
    receipt = {"plan": plan, "planSha256": plan_hash, "applied": False, "readback": False}
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    if args.apply:
        if any(
            os.getenv(key)
            for key in (
                "FIRESTORE_EMULATOR_HOST",
                "STORAGE_EMULATOR_HOST",
                "FIREBASE_STORAGE_EMULATOR_HOST",
                "FIREBASE_AUTH_EMULATOR_HOST",
            )
        ):
            raise ValueError("Cloud publication cannot run with any emulator host")
        if args.plan_sha256 != plan_hash:
            raise ValueError("--apply requires the exact reviewed dry-run plan hash")
        from firebase_admin import credentials, firestore, initialize_app, storage

        credential = None
        if args.gcloud_account:
            from google.oauth2.credentials import Credentials

            result = subprocess.run(
                [
                    "gcloud.cmd" if os.name == "nt" else "gcloud",
                    "auth",
                    "print-access-token",
                    "--account=" + args.gcloud_account,
                    "--quiet",
                ],
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
                env={k: v for k, v in os.environ.items() if k != "PYTHONPATH"},
            )
            token_credential = Credentials(result.stdout.strip())

            class CliCredential(credentials.Base):
                def get_credential(self):
                    return token_credential

            credential = CliCredential()

        app = initialize_app(
            credential, options={"projectId": args.project}, name="kiki-prepared-publication"
        )
        client = firestore.client(app=app, database_id=args.database)
        assets = BucketMediaAssets(storage.bucket(args.bucket, app=app))
        # Persist intent before the first mutation. An interrupted operation has an
        # explicitly uncertain outcome; applied=False never means zero cloud writes.
        receipt.update(writesMayHaveOccurred=True, phase="catalog_activation_started")
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        # Initial publication only: import/publish each enforce absent expected heads.
        receipt["catalogOutcome"] = import_catalog(client, catalog, None)
        receipt["mediaOutcomes"] = []
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        for package in packages:
            receipt["phase"] = "media_started:" + package.manifest.conceptId
            args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
            outcome = publish(client, assets, package, None)
            receipt["mediaOutcomes"].append(
                {"conceptId": package.manifest.conceptId, "outcome": outcome}
            )
            args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        receipt.update(applied=True, phase="readback_started")
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        for path, expected in catalog.documents.items():
            if client.document(path).get(timeout=10).to_dict() != expected:
                raise ValueError("Catalog readback differs")
        for p in packages:
            head = client.document(head_path(catalog.version, p.manifest.conceptId))
            if head.get(timeout=10).to_dict()["currentRevision"] != p.manifest.mediaRevision:
                raise ValueError("Media head readback differs")
            if (
                decode_record(
                    head.collection("revisions")
                    .document(p.manifest.mediaRevision)
                    .get(timeout=10)
                    .to_dict()
                )
                != p.record
            ):
                raise ValueError("Media revision readback differs")
            for asset_id, meta in p.record["assets"].items():
                assets.read(meta["path"], meta["mimeType"], meta["bytes"], asset_id)
        receipt.update(applied=True, readback=True, phase="complete")
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "planSha256": plan_hash,
                "concepts": 10,
                "recordings": 26,
                "applied": receipt["applied"],
                "readback": receipt["readback"],
            }
        )
    )


if __name__ == "__main__":
    main()
