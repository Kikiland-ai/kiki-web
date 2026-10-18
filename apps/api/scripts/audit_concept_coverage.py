"""Offline source/byte inventory. Never contacts cloud or generates/publishes media."""

import argparse
import hashlib
import json
import subprocess
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from kiki_api.learning_catalog import build_catalog
from kiki_api.learning_models import Lesson


def sha(data):
    return hashlib.sha256(data).hexdigest()


def asset(path, expected_hash, expected_bytes):
    if not path.is_file():
        return {"status": "BLOCKED", "reason": "missing_file", "path": str(path.name)}
    data = path.read_bytes()
    pointer = data.startswith(b"version https://git-lfs.github.com/spec/v1")
    valid = not pointer and sha(data) == expected_hash and len(data) == expected_bytes
    return {
        "status": "PASS" if valid else "BLOCKED" if pointer else "FAIL",
        "reason": "verified_bytes"
        if valid
        else "git_lfs_pointer"
        if pointer
        else "checksum_or_size_mismatch",
        "path": str(path.name),
        "expectedSha256": expected_hash,
        "observedSha256": sha(data),
        "expectedBytes": expected_bytes,
        "observedBytes": len(data),
    }


def audit(web, backend):
    catalog = build_catalog(
        web / "data-model/ledgers/electronics/analog-modulation.json",
        web / "data-model/cases/analog-modulation-odia.json",
    )
    clips = json.loads((web / "data-model/media/C-AM-08/narration.provenance.json").read_text())[
        "clips"
    ]
    web_clips = {(c["placardId"], c["lang"]): c for c in clips}
    rows, recordings, scenes = [], [], []
    for packet_path in sorted(
        (backend / "artifacts/cam-review/site/dist/concepts").glob("*/packet.json")
    ):
        packet = json.loads(packet_path.read_text())
        concept = packet["conceptId"]
        base = f"learningCatalog/{packet['planId']}/versions/{catalog.version}"
        lesson = Lesson.model_validate(catalog.documents[f"{base}/lessons/{concept}"])
        packet_cards = {p["id"]: p for p in packet["placards"]}
        assert packet["contentVersion"] == catalog.version
        for clip in packet["narration"]:
            recordings.append(
                {
                    "conceptId": concept,
                    "scope": clip["scope"],
                    "placardIds": clip["placardIds"],
                    "language": clip["language"],
                    "asset": asset(
                        packet_path.parent / clip["localFile"], clip["audioSha256"], clip["bytes"]
                    ),
                }
            )
        scene = packet["scene"]
        renderer = {"C-AM-04": "dsb-sc-visual/v1", "C-AM-08": "coherent-phase-recovery/v1"}.get(
            concept
        )
        scenes.append(
            {
                "conceptId": concept,
                "kind": scene["kind"],
                "packetRevision": packet["experienceRevision"],
                "sceneSha256": sha(json.dumps(scene, sort_keys=True, ensure_ascii=False).encode()),
                "renderer": renderer,
                "contractStatus": "PASS" if concept == "C-AM-08" else "BLOCKED",
                "note": "existing lesson.visual is separate from recovered scene"
                if concept == "C-AM-04"
                else "supported projection"
                if renderer
                else "trusted renderer and Python/Zod projection required",
            }
        )
        for card in lesson.placards:
            for language in ("en", "or"):
                text = card.body.en if language == "en" else card.body.or_
                text_ok = packet_cards[card.id]["body"][language] == text and bool(text)
                matching = [
                    c
                    for c in packet["narration"]
                    if c["language"] == language and card.id in c["placardIds"]
                ]
                narration = [
                    {
                        "origin": "recovered_backend",
                        "scope": c["scope"],
                        "placardId": c.get("placardId"),
                        "contractStatus": "PASS" if c["scope"] == "placard" else "BLOCKED",
                        "sourceTextSha256": c["displayTextSha256"],
                        "sourceBindingStatus": "PASS"
                        if c["scope"] == "placard" and c["displayTextSha256"] == sha(text.encode())
                        else "BLOCKED",
                        "asset": asset(
                            packet_path.parent / c["localFile"], c["audioSha256"], c["bytes"]
                        ),
                    }
                    for c in matching
                ]
                existing = web_clips.get((card.id, language))
                if existing:
                    narration.append(
                        {
                            "origin": "existing_web_package",
                            "scope": "placard",
                            "contractStatus": "PASS",
                            "sourceTextSha256": existing["display_text_sha256"],
                            "sourceBindingStatus": "PASS"
                            if existing["display_text_sha256"] == sha(text.encode())
                            else "FAIL",
                            "asset": asset(
                                web / "data-model/media/C-AM-08" / existing["file"],
                                existing["audio"]["sha256"],
                                existing["audio"]["bytes"],
                            ),
                        }
                    )
                rows.append(
                    {
                        "conceptId": concept,
                        "placardId": card.id,
                        "language": language,
                        "dialLevels": [4, 5] if language == "en" else [1, 2, 3],
                        "dialNote": (
                            "level 3 can explicitly choose either narration language; "
                            "dial is not a new rendition"
                        ),
                        "sourceRevision": packet["sourceGitRevision"],
                        "catalogVersion": catalog.version,
                        "packetRevision": packet["experienceRevision"],
                        "textStatus": "PASS" if text_ok else "FAIL",
                        "textSha256": sha(text.encode()),
                        "narration": narration,
                        "narrationStatus": "BLOCKED"
                        if not any(
                            n["contractStatus"] == "PASS"
                            and n["sourceBindingStatus"] == "PASS"
                            and n["asset"]["status"] == "PASS"
                            for n in narration
                        )
                        else "PASS",
                        "narrationNote": "absent language rendition"
                        if not narration
                        else "whole-concept audio cannot be a placard clip"
                        if all(n["scope"] != "placard" for n in narration)
                        else "see individual asset evidence",
                        "renderer": renderer if card.kind in ("concept", "application") else None,
                        "artifactStatus": "NOT RUN"
                        if renderer and card.kind in ("concept", "application")
                        else "BLOCKED"
                        if card.kind in ("concept", "application")
                        else "NOT RUN",
                        "publication": packet["publication"],
                        "connectedApiStatus": "NOT RUN",
                        "browserStatus": "NOT RUN",
                        "reloadCleanupStatus": "NOT RUN",
                        "deliveryStatus": "BLOCKED",
                        "blockerOwner": (
                            "operator: approved private media bucket/publication; "
                            "backend: LFS bytes and audio scope; web: renderer coverage"
                        ),
                        "evidenceDate": datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat(),
                    }
                )
    assert len(rows) == 80 and len(recordings) == 22 and len(scenes) == 10
    return {
        "schema": "kiki-concept-coverage/v1",
        "scope": "offline source/bytes only; no connected acceptance",
        "webBase": subprocess.check_output(
            ["git", "-C", str(web), "rev-parse", "HEAD"], text=True
        ).strip(),
        "backendBase": subprocess.check_output(
            ["git", "-C", str(backend), "rev-parse", "HEAD"], text=True
        ).strip(),
        "summary": {
            "rows": len(rows),
            "placards": len(rows) // 2,
            "backendRecordingBytes": dict(Counter(c["asset"]["reason"] for c in recordings)),
            "backendNarrationScopes": dict(Counter(c["scope"] for c in recordings)),
            "sourceText": dict(Counter(r["textStatus"] for r in rows)),
            "usableLocalPlacardLanguageAudio": dict(Counter(r["narrationStatus"] for r in rows)),
        },
        "recordings": recordings,
        "scenes": scenes,
        "rows": rows,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = audit(Path(__file__).resolve().parents[3], args.backend_root.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report["summary"]))
