"""Package and publish one concept's prepared media. Dry run unless --apply is given.

The package is built from the committed clips/provenance and the same authored catalog the
importer uses; it must bind to the catalog version that is already active in Firestore.
Assets go to the approved private media bucket; Firestore receives only the manifest.
"""

import argparse
import sys
from pathlib import Path

from kiki_api.concept_media import BucketMediaAssets, build_package, head_path, publish
from kiki_api.learning_catalog import build_catalog
from kiki_api.learning_models import PLAN, Lesson

root = Path(__file__).resolve().parents[3]


def local_package(concept_id: str):
    catalog = build_catalog(
        root / "data-model/ledgers/electronics/analog-modulation.json",
        root / "data-model/cases/analog-modulation-odia.json",
    )
    base = f"learningCatalog/{PLAN}/versions/{catalog.version}"
    lesson = Lesson.model_validate(catalog.documents[f"{base}/lessons/{concept_id}"])
    source = catalog.documents[f"{base}/sourceConcepts/{concept_id}"]
    return build_package(lesson, source, catalog.version, root / "data-model/media" / concept_id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("concept_id", nargs="?", default="C-AM-08")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--bucket", help="Approved private media bucket (KIKI_MEDIA_BUCKET)")
    parser.add_argument("--expected-current", default=None, help="Current media revision, if any")
    args = parser.parse_args()
    package = local_package(args.concept_id)
    manifest = package.manifest
    print(f"{manifest.conceptId} {manifest.mediaRevision} → catalog {manifest.catalogVersion}")
    for clip in manifest.narration:
        print(f"  {clip.renditionId}: {clip.durationSeconds}s, {clip.bytes} bytes, {clip.assetId}")
    for scene in manifest.artifacts:
        print(f"  {scene.artifactId} ({scene.renderer}) on {', '.join(scene.placardIds)}")
    if not args.apply:
        print("Dry run: nothing uploaded or written.")
        sys.exit(0)
    from dotenv import load_dotenv
    from firebase_admin import firestore, initialize_app, storage

    from kiki_api.config import Settings

    load_dotenv(".env.local", override=False)
    settings = Settings()
    bucket = args.bucket or settings.media_bucket
    if not bucket:
        sys.exit("Give --bucket or KIKI_MEDIA_BUCKET: an approved private bucket.")
    app = initialize_app(options={"projectId": settings.firebase_project_id}, name="kiki-media")
    client = firestore.client(app=app, database_id=settings.firestore_database)
    head = client.document(f"learningCatalog/{PLAN}").get(timeout=10)
    if (head.to_dict() or {}).get("currentVersion") != manifest.catalogVersion:
        sys.exit("The active catalog is a different version; rebuild media for it first.")
    assets = BucketMediaAssets(storage.bucket(bucket, app=app))
    outcome = publish(client, assets, package, args.expected_current)
    print(f"{outcome}: {head_path(manifest.catalogVersion, manifest.conceptId)}")
