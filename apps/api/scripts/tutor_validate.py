"""Validate tutor question files: `uv run python scripts/tutor_validate.py <file.json>...`."""

import sys
from pathlib import Path

from pydantic import ValidationError

from kiki_api.tutor.content import TutorQuestion
from kiki_api.tutor.validate import validate


def main(paths: list[str]) -> int:
    failed = 0
    for path in paths:
        try:
            q = TutorQuestion.model_validate_json(Path(path).read_text(encoding="utf-8"))
        except ValidationError as exc:
            failed += 1
            print(f"FAIL {path}: schema\n{exc}")
            continue
        report = validate(q)
        status = "PASS" if report.ok else "FAIL"
        failed += 0 if report.ok else 1
        print(f"{status} {path}: {len(report.errors)} errors, {len(report.warnings)} warnings")
        for e in report.errors:
            print("  error:", e)
        for w in report.warnings:
            print("  warn: ", w)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
