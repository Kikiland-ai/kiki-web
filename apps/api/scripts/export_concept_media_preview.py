"""Public sample-mode media preview, identical to the package Python would publish.

Only the explicit development sample adapter imports this file; connected mode never uses it.
"""

import json

from publish_concept_media import local_package, root

from kiki_api.learning_catalog import dump
from kiki_api.media_models import experience

package = local_package("C-AM-08")
preview = {
    "experience": dump(experience(package.manifest)),
    "manifest": dump(package.manifest),
    # Sample mode reads the same committed clips by file name; this maps them to asset IDs.
    "files": {r.assetId: f"{r.placardId}.{r.lang}.wav" for r in package.manifest.narration},
}
(root / "apps/web/src/fixtures/concept-media-C-AM-08.json").write_text(
    json.dumps(preview, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(f"Exported sample media preview {package.manifest.mediaRevision}; no account data.")
