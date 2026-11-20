"""Rotate Gemini calls across several keys, cooling down a whole quota pool when it fails.

Configured as KIKI_GEMINI_API_KEYS: a JSON list of {"key": "...", "quota_pool": "..."} objects
(the format kiki-backend uses), or a JSON list of key strings. Keys that share a quota pool share
its limits, so a 402/429 on one cools down every key in that pool. Keys are never logged; logs
show the index and pool name only.
"""

import json
import logging
import re
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger("kiki_api.tutor")

BILLING_COOLDOWN_S = 3600  # 402: prepayment credits depleted / billing
AUTH_COOLDOWN_S = 900  # 401/403: bad or restricted key
RATE_COOLDOWN_S = 60  # 429 without advice
SERVER_COOLDOWN_S = 10  # 5xx


@dataclass
class KeyEntry:
    index: int
    key: str
    pool: str


def parse_keys(raw: str) -> list[KeyEntry]:
    """Accept the kiki-backend JSON list of objects, a JSON list of strings, or one bare key."""
    raw = (raw or "").strip()
    if not raw:
        return []
    if raw.startswith("["):
        items = json.loads(raw)
        out = []
        for i, item in enumerate(items):
            if isinstance(item, str):
                out.append(KeyEntry(i, item.strip(), f"key-{i}"))
            elif isinstance(item, dict) and isinstance(item.get("key"), str):
                out.append(
                    KeyEntry(i, item["key"].strip(), str(item.get("quota_pool") or f"key-{i}"))
                )
            else:
                raise ValueError(f"KIKI_GEMINI_API_KEYS entry {i} has no key")
        if any(not e.key for e in out):
            raise ValueError("KIKI_GEMINI_API_KEYS has an empty key")
        return out
    return [KeyEntry(0, raw, "key-0")]


def load_keys(env_file: str | None = None) -> "KeyPool":
    """For scripts and local tools: KIKI_GEMINI_API_KEYS / GEMINI_API_KEYS in the environment, then
    GEMINI_API_KEYS / GEMINI_API_KEY in `env_file` (kiki-backend's .env format), then the
    single-key variables. Never prints a key."""
    import os

    for name in ("KIKI_GEMINI_API_KEYS", "GEMINI_API_KEYS"):
        if os.environ.get(name, "").strip():
            return KeyPool.from_config(os.environ[name])
    if env_file:
        found: dict[str, str] = {}
        with open(env_file, encoding="utf-8") as fh:
            for line in fh:
                m = re.match(r"^\s*(?:export\s+)?(GEMINI_API_KEYS?)\s*=\s*(.*?)\s*$", line)
                if m and m.group(2):
                    found[m.group(1)] = re.sub(r"^(['\"])(.*)\1$", r"\2", m.group(2))
        if found.get("GEMINI_API_KEYS") or found.get("GEMINI_API_KEY"):
            return KeyPool.from_config(found.get("GEMINI_API_KEYS") or found["GEMINI_API_KEY"])
    for name in ("KIKI_GEMINI_API_KEY", "GEMINI_API_KEY"):
        if os.environ.get(name, "").strip():
            return KeyPool.from_config(os.environ[name])
    raise SystemExit("No Gemini keys: set KIKI_GEMINI_API_KEYS (JSON list) or pass --env-file")


def status_of(exc: Exception) -> int | None:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if isinstance(code, int):
        return code
    m = re.match(r"^\s*(\d{3})\b", str(exc))
    return int(m.group(1)) if m else None


def retry_after_s(exc: Exception) -> float | None:
    m = re.search(r"retry(?:Delay)?['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", str(exc))
    return float(m.group(1)) if m else None


class KeyPool:
    def __init__(self, entries: list[KeyEntry], clock=time.monotonic):
        if not entries:
            raise ValueError("no Gemini keys configured")
        self.entries, self.clock = entries, clock
        self._lock = threading.Lock()
        self._next = 0
        self._cool_until: dict[str, float] = {}
        self._last_ok: dict[int, float] = {}

    @classmethod
    def from_config(cls, raw: str) -> "KeyPool":
        return cls(parse_keys(raw))

    def __len__(self):
        return len(self.entries)

    @property
    def pools(self) -> list[str]:
        return sorted({e.pool for e in self.entries})

    def order(self) -> list[KeyEntry]:
        """Keys to try for one call: round-robin from the next key, warm pools first, one key per
        pool."""
        with self._lock:
            n = len(self.entries)
            start = self._next
            self._next = (self._next + 1) % n
            now = self.clock()
            rotated = [self.entries[(start + i) % n] for i in range(n)]
        seen, warm, cold = set(), [], []
        for e in rotated:
            if e.pool in seen:
                continue
            seen.add(e.pool)
            (cold if self._cool_until.get(e.pool, 0) > now else warm).append(e)
        cold.sort(key=lambda e: self._cool_until.get(e.pool, 0))
        return warm + cold  # all pools cooling: still try, soonest-ready first

    def healthy(self) -> KeyEntry:
        """The key to mint long-lived things (voice tokens) with: most recently successful, warm."""
        now = self.clock()
        warm = [e for e in self.entries if self._cool_until.get(e.pool, 0) <= now]
        candidates = warm or self.entries
        return max(candidates, key=lambda e: self._last_ok.get(e.index, -1.0))

    def has_success(self) -> bool:
        return bool(self._last_ok)

    def ok(self, entry: KeyEntry):
        with self._lock:
            self._last_ok[entry.index] = self.clock()
            self._cool_until.pop(entry.pool, None)

    def failed(self, entry: KeyEntry, exc: Exception) -> bool:
        """Record a failure. True when another key/pool is worth trying for the same call."""
        status = status_of(exc)
        if status == 402:
            wait = BILLING_COOLDOWN_S
        elif status in (401, 403):
            wait = AUTH_COOLDOWN_S
        elif status == 429:
            wait = retry_after_s(exc) or RATE_COOLDOWN_S
        elif status is not None and status >= 500:
            wait = SERVER_COOLDOWN_S
        else:
            return False  # timeouts, bad requests, parse errors: another key will not help
        with self._lock:
            self._cool_until[entry.pool] = max(
                self._cool_until.get(entry.pool, 0), self.clock() + wait
            )
        logger.warning(
            "Gemini key %d (pool %s) cooling down %ds after HTTP %s",
            entry.index,
            entry.pool,
            int(wait),
            status,
        )
        return True


class Clients:
    """One google-genai client per key, created on first use."""

    def __init__(self, pool: KeyPool, **client_kw):
        self.pool, self.kw = pool, client_kw
        self._clients: dict[int, object] = {}
        self._lock = threading.Lock()

    def get(self, entry: KeyEntry):
        with self._lock:
            if entry.index not in self._clients:
                from google import genai

                self._clients[entry.index] = genai.Client(api_key=entry.key, **self.kw)
            return self._clients[entry.index]

    def call(self, fn):
        """Run fn(client) on the first working pool; raise the last error if every pool fails."""
        last = None
        for entry in self.pool.order():
            try:
                result = fn(self.get(entry))
            except Exception as exc:  # noqa: BLE001
                last = exc
                if self.pool.failed(entry, exc):
                    continue
                raise
            self.pool.ok(entry)
            return result
        raise last if last else RuntimeError("no Gemini keys")
