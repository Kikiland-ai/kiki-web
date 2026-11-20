"""Short-lived Gemini Live tokens for the browser. The real key never leaves the server.

The token locks the model and the session config (KiKi's voice instruction, the single
submit_reply tool, audio out, transcription both ways), so a browser can open a Live
session as KiKi's voice and nothing else.
"""

import datetime as dt
from pathlib import Path

PROMPT_VERSION = "voice.v1"
VOICE_PROMPT = (Path(__file__).parent / "prompts" / f"{PROMPT_VERSION}.md").read_text(encoding="utf-8")

SUBMIT_REPLY = {
    "name": "submit_reply",
    "description": "Send the student's answer to the tutoring system. Returns the next BRIEF to speak.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "heard_text": {"type": "STRING", "description": "Exactly what the student said."},
            "lang": {"type": "STRING", "enum": ["en", "or", "mixed"]},
        },
        "required": ["heard_text", "lang"],
    },
}


def live_config() -> dict:
    return {
        "response_modalities": ["AUDIO"],
        "system_instruction": VOICE_PROMPT,
        "tools": [{"function_declarations": [SUBMIT_REPLY]}],
        "output_audio_transcription": {},
        "input_audio_transcription": {},
        "session_resumption": {},
    }


class VoiceTokens:
    def __init__(self, api_key: str, model: str):
        from google import genai

        self.model = model
        self.client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})

    def mint(self) -> dict:
        now = dt.datetime.now(tz=dt.timezone.utc)
        expires = now + dt.timedelta(minutes=30)
        token = self.client.auth_tokens.create(config={
            "uses": 1,
            "expire_time": expires,
            "new_session_expire_time": now + dt.timedelta(minutes=1),
            "live_connect_constraints": {"model": self.model, "config": live_config()},
            "lock_additional_fields": [],
            "http_options": {"api_version": "v1alpha"},
        })
        return {"token": token.name, "model": self.model, "expiresAt": expires.isoformat(),
                "prompt": PROMPT_VERSION}
