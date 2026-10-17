"""Export public API schemas without authenticating or accessing any learner records."""

import json
from pathlib import Path

from kiki_api.config import Settings
from kiki_api.main import create_app

if __name__ == "__main__":
    schema = create_app(Settings()).openapi()
    Path("openapi.json").write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(
        "Exported public profile, material, learning, assessment "
        "and lab-preparation OpenAPI contract."
    )
