# ruff: noqa: E402
"""Regenerate the synthetic Python→Zod receipt from the pinned upstream's offline test.

No learner data, credentials, real provider or media is included.
"""

import asyncio
import importlib.util
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]
backend = Path(os.environ["KIKI_BACKEND_CHECKOUT"]).resolve()
sys.path.insert(0, str(backend))
spec = importlib.util.spec_from_file_location(
    "backend_stream_tests", backend / "tests/test_json_stream.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


async def main():
    test = module.PipelineTests()
    await test.asyncSetUp()
    try:
        from prototypes.json_stream.api import stream_router

        state = test.service.project(test.service.load(test.id, "owner"))

        class Request:
            async def stream(self):
                yield json.dumps(
                    {
                        "revision": state["revision"],
                        "frame_id": test.capture["frame"]["frame_id"],
                        "view_revision": 1,
                    }
                ).encode()

        endpoint = stream_router(test.service, lambda r: "owner", lambda r: None).routes[0].endpoint
        response = await endpoint(test.id, Request())
        events = []
        async for chunk in response.body_iterator:
            events.extend(json.loads(packet[6:]) for packet in chunk.strip().split("\n\n"))
        value = {
            "start": state,
            "frame": test.capture["frame"],
            "events": [
                e
                for e in events
                if e["type"]
                in {
                    "admitted",
                    "provisional_findings",
                    "guidance_committed",
                    "stream_complete",
                }
            ],
        }
        path = root / "apps/web/src/features/labs/__fixtures__/python-execution.json"
        path.write_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        print(f"Synthetic Python receipt: {path.stat().st_size} bytes")
    finally:
        await test.asyncTearDown()


asyncio.run(main())
