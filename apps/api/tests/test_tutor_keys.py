"""Key rotation: formats, round-robin, quota-pool cooldowns, fall-through within one call."""

import json

import pytest
from pydantic import ValidationError

from kiki_api.config import Settings
from kiki_api.tutor.keys import Clients, KeyEntry, KeyPool, parse_keys, status_of


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class HTTPError(Exception):
    def __init__(self, code, msg=""):
        super().__init__(f"{code} {msg}")
        self.code = code


def pool(*pools, clock=None):
    return KeyPool([KeyEntry(i, f"k{i}", p) for i, p in enumerate(pools)], clock=clock or Clock())


def test_parses_the_kiki_backend_format_strings_and_a_bare_key():
    raw = json.dumps([{"key": "a", "quota_pool": "gareebi"}, {"key": "b", "quota_pool": "default"}, {"key": "c"}])
    assert [(e.index, e.key, e.pool) for e in parse_keys(raw)] == [(0, "a", "gareebi"), (1, "b", "default"), (2, "c", "key-2")]
    assert [e.pool for e in parse_keys('["x", "y"]')] == ["key-0", "key-1"]
    assert [e.key for e in parse_keys("  single  ")] == ["single"]
    with pytest.raises(ValueError):
        parse_keys('[{"quota_pool": "p"}]')
    with pytest.raises(ValueError):
        parse_keys('[""]')


def test_round_robin_and_one_attempt_per_quota_pool():
    p = pool("a", "b", "c", "c")
    firsts = [p.order()[0].index for _ in range(4)]
    assert firsts == [0, 1, 2, 3]
    assert [e.pool for e in p.order()] == ["a", "b", "c"]   # keys 2 and 3 share pool c: tried once


def test_a_billing_failure_cools_the_whole_pool_and_the_call_moves_on():
    clock = Clock()
    p = pool("gareebi", "proj", "default", "default", clock=clock)
    assert p.failed(p.entries[2], HTTPError(402, "prepayment credits are depleted"))
    for _ in range(4):
        order = p.order()
        assert order[-1].pool == "default"                   # cooling pool goes last for every call
    clock.t += 3601                                          # after the billing cooldown it is warm again
    seen = {tuple(e.pool for e in p.order()) for _ in range(4)}
    assert any(order[-1] != "default" for order in seen)    # no longer forced to the back


def test_rate_limit_uses_the_advised_delay():
    clock = Clock()
    p = pool("a", "b", clock=clock)
    p.failed(p.entries[0], HTTPError(429, "{'retryDelay': '7s'}"))
    assert p.order()[0].pool == "b"
    clock.t += 8
    assert {e.pool for e in p.order()} == {"a", "b"} and p._cool_until["a"] < clock.t


def test_errors_another_key_cannot_fix_are_not_retried():
    p = pool("a", "b")
    assert p.failed(p.entries[0], HTTPError(400, "bad request")) is False
    assert p.failed(p.entries[0], TimeoutError()) is False
    assert not p._cool_until


def test_clients_fall_through_to_a_working_pool_and_remember_health():
    p = pool("gareebi", "proj", "default")
    calls = []

    class Fake:
        def __init__(self, i):
            self.i = i

    clients = Clients(p)
    for e in p.entries:
        clients._clients[e.index] = Fake(e.index)

    def fn(c):
        calls.append(c.i)
        if c.i == 0:
            raise HTTPError(402, "Your prepayment credits are depleted")
        return f"ok from {c.i}"

    assert clients.call(fn) == "ok from 1" and calls == [0, 1]
    assert p.healthy().index == 1 and p.has_success()
    calls.clear()
    assert clients.call(fn).startswith("ok") and 0 not in calls   # the cooling pool is tried last


def test_every_pool_failing_raises_the_last_error():
    p = pool("a", "b")
    clients = Clients(p)
    for e in p.entries:
        clients._clients[e.index] = object()
    with pytest.raises(HTTPError):
        clients.call(lambda c: (_ for _ in ()).throw(HTTPError(429)))


def test_status_parsing():
    assert status_of(HTTPError(402)) == 402
    assert status_of(Exception("429 RESOURCE_EXHAUSTED")) == 429
    assert status_of(Exception("boom")) is None


def test_settings_accept_a_key_list_and_reject_a_broken_one():
    ok = Settings(_env_file=None, firebase_project_id="p", tutor_enabled=True,
                  gemini_api_keys=json.dumps([{"key": "a", "quota_pool": "x"}]))
    assert ok.gemini_keys_raw().startswith("[")
    with pytest.raises(ValidationError, match="valid key list"):
        Settings(_env_file=None, firebase_project_id="p", gemini_api_keys="[{")
    shown = repr(ok) + str(ok.model_dump())
    assert '"key": "a"' not in shown and "'key': 'a'" not in shown    # the key list stays secret


def test_voice_tokens_probe_for_a_working_pool_before_the_first_mint():
    from kiki_api.tutor.voice import VoiceTokens

    p = pool("gareebi", "proj")
    vt = VoiceTokens(p, "gemini-3.8-live")
    probed, minted = [], []

    class Models:
        def __init__(self, i):
            self.i = i

        def generate_content(self, **_):
            probed.append(self.i)
            if self.i == 0:
                raise HTTPError(402, "prepayment credits are depleted")

    class Tokens:
        def __init__(self, i):
            self.i = i

        def create(self, config):
            minted.append(self.i)
            return type("T", (), {"name": f"auth_tokens/{self.i}"})()

    for e in p.entries:
        vt._probe._clients[e.index] = type("C", (), {"models": Models(e.index)})()
        vt.clients._clients[e.index] = type("C", (), {"auth_tokens": Tokens(e.index)})()
    out = vt.mint()
    assert probed[:2] == [0, 1] and minted == [1] and out["token"] == "auth_tokens/1"
