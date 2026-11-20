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
    def __init__(self, keys, model: str, probe_model: str = "gemini-3.5-flash-lite"):
        from .keys import Clients, KeyPool

        self.model, self.probe_model = model, probe_model
        self.pool = keys if isinstance(keys, KeyPool) else KeyPool.from_config(keys)
        self.clients = Clients(self.pool, http_options={"api_version": "v1alpha"})
        self._probe = Clients(self.pool)

    def mint(self) -> dict:
        """Mint from the most recently healthy key: a token from a project without credit only
        fails later, when the browser connects, so prefer a key known to be working. If nothing
        has succeeded yet, one tiny call finds a working pool first."""
        if not self.pool.has_success():
            self._probe.call(lambda c: c.models.generate_content(model=self.probe_model, contents="ok"))
        entry = self.pool.healthy()
        try:
            out = self._mint(self.clients.get(entry))
        except Exception as exc:  # noqa: BLE001
            if not self.pool.failed(entry, exc):
                raise
            out = self.clients.call(self._mint)      # rotate through the remaining pools
            return out
        self.pool.ok(entry)
        return out

    def _mint(self, client) -> dict:
        now = dt.datetime.now(tz=dt.timezone.utc)
        expires = now + dt.timedelta(minutes=30)
        token = client.auth_tokens.create(config={
            "uses": 1,
            "expire_time": expires,
            "new_session_expire_time": now + dt.timedelta(minutes=1),
            "live_connect_constraints": {"model": self.model, "config": live_config()},
            "lock_additional_fields": [],
            "http_options": {"api_version": "v1alpha"},
        })
        return {"token": token.name, "model": self.model, "expiresAt": expires.isoformat(),
                "prompt": PROMPT_VERSION}
