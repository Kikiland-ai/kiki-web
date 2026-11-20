"""Prepare a real-browser voice check: a student-speech WAV for Chromium's fake mic and a token.

  uv run python scripts/tutor_voice_browser_prep.py <out-dir> "I think part of it comes back"
Writes <out-dir>/student.wav (24 kHz mono, 1.5 s lead-in, 4 s tail so voice detection ends the
turn) and <out-dir>/token.json (a single-use locked Live token; expires in 30 minutes).
"""

import json
import os
import sys
import wave
from pathlib import Path

from google import genai
from google.genai import types

from kiki_api.tutor.voice import VoiceTokens


def working_key(env_file=None):
    """A key from the pool whose quota pool answers right now (probed once), and the pool."""
    from kiki_api.tutor.keys import Clients, load_keys

    pool = load_keys(env_file or os.environ.get("KIKI_GEMINI_ENV_FILE"))
    Clients(pool).call(lambda c: c.models.generate_content(model="gemini-3.5-flash-lite", contents="ok"))
    return pool.healthy().key, pool


def main(out: str, text: str):
    key, pool = working_key()
    d = Path(out)
    d.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=key)          # keep a reference: a collected client closes itself
    res = client.models.generate_content(
        model="gemini-3.8-flash-lite-tts", contents=text,
        config=types.GenerateContentConfig(response_modalities=["AUDIO"]))
    pcm = res.candidates[0].content.parts[0].inline_data.data
    with wave.open(str(d / "student.wav"), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000)
        w.writeframes(bytes(int(24000 * 1.5) * 2) + pcm + bytes(24000 * 4 * 2))
    (d / "token.json").write_text(json.dumps(VoiceTokens(pool, "gemini-3.8-live").mint()), encoding="utf-8")
    print("wrote", d / "student.wav", "and token.json")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
