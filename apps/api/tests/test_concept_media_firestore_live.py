"""Opt-in lossless media storage on the explicitly selected named Firestore database."""

import json
import os
import shutil
import subprocess
from pathlib import Path
from uuid import uuid4

import pytest

from kiki_api.concept_media import decode_record, encode_record


def test_actual_nested_array_rejection_and_encoded_all_ten_readback():
    project = os.environ.get("KIKI_TICKET_TEST_PROJECT")
    database = os.environ.get("KIKI_TICKET_TEST_DATABASE")
    if not project or not database or database == "(default)":
        pytest.skip("Explicit project and named database required for live scratch writes")
    from google.api_core.exceptions import InvalidArgument
    from google.cloud import firestore

    credentials = None
    account = os.environ.get("KIKI_TICKET_TEST_GCLOUD_ACCOUNT")
    if account:
        from google.oauth2.credentials import Credentials

        executable = shutil.which("gcloud.cmd") or shutil.which("gcloud")
        if not executable:
            raise RuntimeError("Approved cloud test identity is unavailable")
        result = subprocess.run(
            [executable, "auth", "print-access-token", "--account", account],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode or not result.stdout.strip():
            raise RuntimeError("Approved cloud test identity is unavailable")
        credentials = Credentials(token=result.stdout.strip())
    client = firestore.Client(project=project, database=database, credentials=credentials)
    ref = client.collection("cloudMediaStorageContracts").document("scratch-" + uuid4().hex)
    folder = Path(__file__).resolve().parents[3] / "apps/web/src/fixtures/all-cam"
    try:
        original = json.loads((folder / "C-AM-01.json").read_text(encoding="utf-8"))
        with pytest.raises(InvalidArgument):
            ref.set(original)
        for index in range(1, 11):
            original = json.loads((folder / f"C-AM-{index:02d}.json").read_text(encoding="utf-8"))
            envelope = encode_record(original)
            ref.set(envelope)
            saved = ref.get(timeout=10).to_dict()
            assert saved == envelope
            assert decode_record(saved) == original
            if index == 8:
                assert (
                    decode_record(saved)["manifest"]["mediaRevision"]
                    == "cm-e0f086007cc9f2062af093f3"
                )
    finally:
        ref.delete()
        assert not ref.get(timeout=10).exists
        client.close()
