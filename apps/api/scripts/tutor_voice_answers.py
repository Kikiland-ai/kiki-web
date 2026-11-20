"""Synthesise a student's spoken answers for a scripted voice run of the tutor screen.

  uv run python scripts/tutor_voice_answers.py <out.json> --env-file <kiki-backend/.env> \\
      "answer 1" "answer 2" ...
Writes {"rate": 24000, "answers": [{"text", "pcm"}]} with base64 16-bit PCM at 24 kHz per answer.
Uses the key pool (rotates by quota pool); never prints a key.
"""

import argparse
import base64
import json
from pathlib import Path

from google.genai import types

from kiki_api.tutor.keys import Clients, load_keys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("answers", nargs="+")
    ap.add_argument("--env-file")
    ap.add_argument("--model", default="gemini-3.8-flash-lite-tts")
    a = ap.parse_args()
    clients = Clients(load_keys(a.env_file))
    out = []
    for text in a.answers:
        res = clients.call(
            lambda c, text=text: c.models.generate_content(
                model=a.model,
                contents=text,
                config=types.GenerateContentConfig(response_modalities=["AUDIO"]),
            )
        )
        pcm = res.candidates[0].content.parts[0].inline_data.data
        out.append({"text": text, "pcm": base64.b64encode(pcm).decode()})
        print(f"{len(pcm) / 48000:5.1f} s  {text[:70]}")
    Path(a.out).write_text(json.dumps({"rate": 24000, "answers": out}), encoding="utf-8")


if __name__ == "__main__":
    main()
