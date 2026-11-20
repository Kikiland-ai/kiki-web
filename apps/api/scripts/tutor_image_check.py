"""Check the API image contains everything tutor mode reads, without Docker.

  uv run python scripts/tutor_image_check.py
Copies exactly what apps/api/Dockerfile COPYs (repo-relative) into a scratch /app tree, then
imports the app from that tree in a fresh interpreter and loads every tutor runtime file.
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
DOCKERFILE = REPO / "apps/api/Dockerfile"
WORKDIR = "/app/apps/api"

PROBE = r"""
import json
from kiki_api.main import create_app
from kiki_api.config import Settings
from kiki_api.tutor.service import load_questions, load_concept_titles, QUESTIONS_DIR, LEDGER
from kiki_api.tutor.classifier import PROMPT as CLASSIFY
from kiki_api.tutor.voice import VOICE_PROMPT
qs = load_questions()
titles = load_concept_titles()
assert qs, "no questions in image"
assert titles, f"ledger titles missing at {LEDGER}"
assert "{question}" in CLASSIFY and "submit_reply" in VOICE_PROMPT
create_app(Settings(_env_file=None, firebase_project_id="image-check"))
print(json.dumps({"questions": sorted(qs), "titles": len(titles), "questionsDir": str(QUESTIONS_DIR)}))
"""


def copies():
    for line in DOCKERFILE.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0] == "COPY" and not parts[1].startswith("--"):
            yield parts[1], parts[2]


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        work = root / WORKDIR.lstrip("/")
        work.mkdir(parents=True)
        for src, dst in copies():
            source = REPO / src
            target = Path(dst) if dst.startswith("/") else Path(WORKDIR) / dst
            target = root / str(target).lstrip("/\\")
            if source.is_dir():
                shutil.copytree(source, target, dirs_exist_ok=True,
                                ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.routing.json", "*.README.md"))
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
            print("COPY", src, "->", dst)
        env = {"PYTHONPATH": str(work / "src"), "PYTHONUTF8": "1", "SYSTEMROOT": __import__("os").environ.get("SYSTEMROOT", "")}
        res = subprocess.run([sys.executable, "-I", "-c", "import sys; sys.path.insert(0, %r)\n" % str(work / "src") + PROBE],
                             cwd=work, env=env, capture_output=True, text=True, timeout=120)
        print(res.stdout.strip() or res.stderr.strip()[-2000:])
        if res.returncode != 0:
            return res.returncode
        import json

        read_from = Path(json.loads(res.stdout.strip().splitlines()[-1])["questionsDir"]).resolve()
        if root.resolve() not in read_from.parents:
            print(f"FAIL: questions were read from {read_from}, not the image tree")
            return 1
        print("PASS: the image tree alone serves tutor mode")
        return 0


if __name__ == "__main__":
    sys.exit(main())
