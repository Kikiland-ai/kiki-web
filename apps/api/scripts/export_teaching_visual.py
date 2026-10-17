"""Public visual preview from authored source; never a connected runtime fallback."""

import json
from pathlib import Path

from kiki_api.learning_catalog import dump
from kiki_api.teaching_visuals import project_dsb_visual

root = Path(__file__).resolve().parents[3]
ledger = json.loads(
    (root / "data-model/ledgers/electronics/analog-modulation.json").read_text(encoding="utf-8")
)
source = next(c for c in ledger["concepts"] if c["id"] == "C-AM-04")
visual = project_dsb_visual(source)
(root / "apps/web/src/fixtures/dsb-sc-visual.json").write_text(
    json.dumps(dump(visual), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print("Exported public visual specification only; no account or scoring data.")
