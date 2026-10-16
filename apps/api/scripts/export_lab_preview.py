"""Export only public practical instructions for labelled development preview."""

import json
from pathlib import Path

from kiki_api.lab_preparation import project_practical
from kiki_api.learning_catalog import build_catalog, dump
from kiki_api.learning_models import PLAN, PRACTICAL

root = Path(__file__).resolve().parents[3]
catalog = build_catalog(
    root / "data-model/ledgers/electronics/analog-modulation.json",
    root / "data-model/cases/analog-modulation-odia.json",
)
content = catalog.documents[
    f"learningCatalog/{PLAN}/versions/{catalog.version}/practicals/{PRACTICAL}"
]
practical = project_practical(content, catalog.manifest, catalog.version)
(root / "apps/web/src/fixtures/lab-practical.json").write_text(
    json.dumps(dump(practical), ensure_ascii=False, indent=2) + "\n"
)
print("Exported public practical only; no account, scores, answers or trusted evidence.")
