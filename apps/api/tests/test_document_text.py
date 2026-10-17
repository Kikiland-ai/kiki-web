"""Text-only Firestore boundary. No bucket, live credentials or learner data."""

import json
from copy import deepcopy
from pathlib import Path

import pytest
from test_materials import material_harness as material_harness
from test_profiles import headers

from kiki_api.document_text import CHUNK_BYTES, MAX_TEXT_BODY_BYTES


def body(text="DSB-SC has two sidebands.\nଓଡ଼ିଆ ପାଠ"):
    return {
        "courseId": "CRS-AC-ECE",
        "kind": "notes",
        "topic": "Analog Modulation",
        "note": "Text only",
        "classDate": "2026-10-17",
        "documents": [
            {
                "title": "lesson.pdf",
                "mime": "application/pdf",
                "size": 1000,
                "method": "pdf-text",
                "unitLabel": "page",
                "unitCount": 2,
                "units": [{"number": 1, "text": text}, {"number": 2, "text": "Carrier reference"}],
                "warnings": ["Images are not retained."],
            }
        ],
    }


def save(client, payload=None, user="a", key="text-save-01"):
    return client.post(
        "/study-requests/text",
        json=payload or body(),
        headers={**headers(user), "Idempotency-Key": key},
    )


def test_text_save_list_read_and_original_unavailable_without_storage(material_harness):
    client, store, bucket, library = material_harness
    library.originals = None
    response = save(client)
    assert response.status_code == 200, response.text
    receipt = response.json()["request"]
    assert receipt["status"] == "text_saved" and receipt["jobId"] is None
    source = receipt["sources"][0]
    assert source["originalAvailable"] is False and source["sha256"] is None
    assert source["textSummary"]["unitCount"] == 2
    assert bucket.writes == 0
    assert not any("/intakeJobs/" in key for key in store.docs)
    assert not any("/uploadOperations/" in key for key in store.docs)
    listed = client.get("/study-requests", headers=headers()).json()
    assert listed["requests"] == [receipt]
    result = client.get(f"/source-docs/{source['id']}/text", headers=headers()).json()
    assert result["nextCursor"] is None
    assert (
        result["chunks"][0]["text"]
        == "Page 1\n" + body()["documents"][0]["units"][0]["text"] + "\n\nPage 2\nCarrier reference"
    )
    assert client.get(f"/source-docs/{source['id']}/content", headers=headers()).status_code == 409
    artifact = Path("test-artifacts/document-text-contract.json")
    artifact.parent.mkdir(exist_ok=True)
    artifact.write_text(json.dumps({"receipt": response.json(), "list": listed, "text": result}))


def test_text_idempotency_changed_payload_and_owner_isolation(material_harness):
    client, store, bucket, _ = material_harness
    first = save(client).json()
    count = len(store.docs)
    assert save(client).json() == first
    assert len(store.docs) == count
    assert save(client, body("Changed text")).status_code == 409
    assert len(store.docs) == count and bucket.writes == 0
    source = first["request"]["sources"][0]["id"]
    assert client.get(f"/source-docs/{source}/text", headers=headers("b")).status_code == 404
    assert client.get("/study-requests", headers=headers("b")).json()["requests"] == []
    assert save(client, user="b").json()["request"]["id"] != first["request"]["id"]


def test_text_requires_auth_enrollment_and_valid_operation_key(material_harness):
    client, store, _, _ = material_harness
    assert client.post("/study-requests/text", json=body()).status_code == 401
    store.docs["learners/b"]["courseIds"] = []
    assert save(client, user="b").status_code == 409
    assert save(client, key="bad key!!!").status_code == 422


@pytest.mark.parametrize(
    "change",
    [
        lambda d: d.update(mime="image/png"),
        lambda d: d.update(method="pasted"),
        lambda d: d.update(unitCount=501),
        lambda d: d.update(units=[]),
        lambda d: d["units"][0].update(text=" "),
        lambda d: d["units"][1].update(number=1),
        lambda d: d["units"][0].update(text="ଓ" * 400000),
        lambda d: d.update(blob="Not an allowed field"),
    ],
)
def test_invalid_or_oversize_text_does_not_write(material_harness, change):
    client, store, _, _ = material_harness
    payload = body()
    change(payload["documents"][0])
    count = len(store.docs)
    assert save(client, payload).status_code == 422
    assert len(store.docs) == count


def test_unicode_chunks_are_bounded_paginated_and_not_truncated(material_harness):
    client, store, _, _ = material_harness
    payload = body("ଓଡ଼ିଆ English\n" * 12000)
    receipt = save(client, payload).json()["request"]
    source = receipt["sources"][0]
    cursor, actual = 0, []
    while cursor is not None:
        result = client.get(
            f"/source-docs/{source['id']}/text?cursor={cursor}", headers=headers()
        ).json()
        assert len(result["chunks"]) <= 5
        actual.extend(c["text"] for c in result["chunks"])
        cursor = result["nextCursor"]
    expected = (
        "Page 1\n" + payload["documents"][0]["units"][0]["text"] + "\n\nPage 2\nCarrier reference"
    )
    assert "".join(actual) == expected
    assert len(actual) == source["textSummary"]["chunkCount"] > 5
    assert all(len(text.encode()) <= CHUNK_BYTES for text in actual)
    assert all(
        len(json.dumps(doc, ensure_ascii=False).encode()) < 1024 * 1024
        for path, doc in store.docs.items()
        if "/textChunks/" in path
    )
    assert (
        client.get(f"/source-docs/{source['id']}/text?cursor=999", headers=headers()).status_code
        == 422
    )
    assert (
        client.get(f"/source-docs/{source['id']}/text?cursor=-1", headers=headers()).status_code
        == 422
    )
    path = next(p for p in store.docs if p.endswith("/textChunks/0000"))
    store.docs[path]["text"] = "Tampered text"
    assert client.get(f"/source-docs/{source['id']}/text", headers=headers()).status_code == 503


def test_text_json_body_is_bounded(material_harness):
    client, store, _, _ = material_harness
    count = len(store.docs)
    result = client.post(
        "/study-requests/text",
        content=b" " * (MAX_TEXT_BODY_BYTES + 1),
        headers={
            **headers(),
            "Content-Type": "application/json",
            "Idempotency-Key": "text-save-big",
        },
    )
    assert result.status_code == 413
    assert len(store.docs) == count


def test_powerpoint_and_pasted_text_modes(material_harness):
    client, _, _, _ = material_harness
    for mime, method, label in [
        (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "pptx-text",
            "slide",
        ),
        ("text/plain", "pasted", "section"),
    ]:
        payload = deepcopy(body())
        payload["documents"][0].update(mime=mime, method=method, unitLabel=label)
        response = save(client, payload, key=f"text-save-{method}")
        assert response.status_code == 200
        source = response.json()["request"]["sources"][0]
        text = client.get(f"/source-docs/{source['id']}/text", headers=headers()).json()
        assert text["chunks"][0]["text"].startswith(label.capitalize() + " 1\n")
