"""Voice spike: drive Gemini Live as KiKi's voice against the real tutor service.

  uv run python scripts/tutor_voice_spike.py --question ece-phase-error --lang en \
      --say "it gets weaker but not zero" --say "it is multiplied by cos phi" ...

Each --say is sent as the student's turn (text by default, or synthesised speech with --audio).
Checks per turn: Live calls submit_reply, latency to the tool call and to first audio, and how
close Live's spoken transcript is to the scripted brief. Writes a JSON report with --out.
"""

import argparse
import asyncio
import difflib
import json
import os
import re
import sys
import time
from pathlib import Path

from google import genai
from google.genai import types

from kiki_api.tutor.classifier import GeminiClassifier
from kiki_api.tutor.service import TutorService, load_questions
from kiki_api.tutor.store import MemoryTutorStore

PROMPT = (Path(__file__).resolve().parents[1] / "src/kiki_api/tutor/prompts/voice.v1.md").read_text(encoding="utf-8")
SUBMIT = types.FunctionDeclaration(
    name="submit_reply",
    description="Send the student's answer to the tutoring system. Returns the next BRIEF to speak.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "heard_text": types.Schema(type="STRING", description="Exactly what the student said."),
            "lang": types.Schema(type="STRING", enum=["en", "or", "mixed"]),
        },
        required=["heard_text", "lang"],
    ),
)


def brief_for_voice(view: dict) -> dict:
    b = view["brief"]
    out = {"mode": b["mode"], "lang": b["lang"], "say": b["say"], "expectsReply": b["expectsReply"]}
    for k in ("goal", "mustNotReveal", "studentSaid"):
        if k in b:
            out[k] = b[k]
    return out


def similarity(a: str, b: str) -> float:
    norm = lambda s: re.sub(r"[^\w]+", " ", s.lower()).split()
    return round(difflib.SequenceMatcher(None, norm(a), norm(b)).ratio(), 3)


async def tts_pcm16k(client, text: str) -> bytes:
    """Student speech for --audio: Gemini TTS at 24 kHz, decimated to 16 kHz PCM."""
    res = client.models.generate_content(
        model="gemini-3.8-flash-lite-tts", contents=text,
        config=types.GenerateContentConfig(response_modalities=["AUDIO"]),
    )
    pcm24 = res.candidates[0].content.parts[0].inline_data.data
    import array

    src = array.array("h", pcm24)
    n = int(len(src) * 16000 / 24000)
    dst = array.array("h", (src[min(len(src) - 1, int(i * 1.5))] for i in range(n)))
    return dst.tobytes()


async def main(a):
    key = os.environ.get("KIKI_GEMINI_API_KEY") or os.environ["GEMINI_API_KEY"]
    client = genai.Client(api_key=key)
    svc = TutorService(load_questions(), GeminiClassifier(key, a.classifier, retries_on_429=3),
                       MemoryTutorStore(), None)
    view = svc.start("spike", a.question, a.lang, "spike-start-1")
    sid = view["sessionId"]
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=PROMPT,
        tools=[types.Tool(function_declarations=[SUBMIT])],
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
    )
    turns, report = list(a.say), {"model": a.live_model, "lang": a.lang, "turns": []}
    # synthesise student speech BEFORE connecting: blocking calls inside the session starve keep-alives
    pcms = [await tts_pcm16k(client, s) for s in turns] if a.audio else [None] * len(turns)
    async with client.aio.live.connect(model=a.live_model, config=config) as session:

        async def speak_and_listen(expected: str, t_sent: float, record: dict):
            """Read server messages until Live finishes a turn or calls the tool."""
            spoken, first_audio, tool_call, done = [], None, None, False
            audio = bytearray()
            deadline = time.perf_counter() + 25
            while not done and time.perf_counter() < deadline:
                # receive() ends at each turn boundary; keep reading until speech then turn end
                async for msg in session.receive():
                    if msg.data:
                        audio.extend(msg.data)
                        if first_audio is None:
                            first_audio = time.perf_counter()
                    sc = msg.server_content
                    if sc and sc.output_transcription and sc.output_transcription.text:
                        spoken.append(sc.output_transcription.text)
                    if msg.tool_call:
                        tool_call, done = msg.tool_call, True
                        break
                    if sc and sc.turn_complete and (first_audio or not expected):
                        done = True
                        break
                if not expected and not tool_call and first_audio is None:
                    continue
            said = "".join(spoken).strip()
            if a.save_audio and audio:
                import wave

                Path(a.save_audio).mkdir(parents=True, exist_ok=True)
                name = Path(a.save_audio) / f"{a.lang}-turn{record.get('turn', 0)}-{len(report['turns'])}.wav"
                with wave.open(str(name), "wb") as w:
                    w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000)
                    w.writeframes(bytes(audio))
                record["audioFile"] = str(name)
                record["audioSeconds"] = round(len(audio) / 48000, 1)
            record.update({
                "spoken": said, "expected": expected, "verbatim": similarity(said, expected),
                "firstAudioMs": int((first_audio - t_sent) * 1000) if first_audio else None,
            })
            return tool_call

        # KiKi opens with the first brief
        first = brief_for_voice(view)
        t0 = time.perf_counter()
        await session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text="BRIEF " + json.dumps(first, ensure_ascii=False))]),
            turn_complete=True,
        )
        rec = {"turn": 0, "node": view["node"]}
        await speak_and_listen(first["say"], t0, rec)
        report["turns"].append(rec)

        for i, student in enumerate(turns, start=1):
            rec = {"turn": i, "node": view["node"], "student": student}
            t_sent = time.perf_counter()
            if a.audio:
                pcm = pcms[i - 1]
                for k in range(0, len(pcm), 3200):            # 100 ms chunks at real-time pace
                    await session.send_realtime_input(audio=types.Blob(data=pcm[k:k + 3200], mime_type="audio/pcm;rate=16000"))
                    await asyncio.sleep(0.1)
                silence = bytes(3200)
                for _ in range(8):                            # 0.8 s of silence lets VAD end the turn
                    await session.send_realtime_input(audio=types.Blob(data=silence, mime_type="audio/pcm;rate=16000"))
                    await asyncio.sleep(0.1)
                t_sent = time.perf_counter() - 0.8            # measure from the end of speech
            else:
                await session.send_realtime_input(text=student)
            call = await speak_and_listen("", t_sent, rec)
            rec["spokeBeforeTool"] = rec.pop("spoken")
            rec.pop("expected"), rec.pop("verbatim")
            if not call:
                rec["toolCalled"] = False
                report["turns"].append(rec)
                break
            fc = call.function_calls[0]
            rec.update({"toolCalled": True, "toolMs": int((time.perf_counter() - t_sent) * 1000),
                        "heard": fc.args.get("heard_text"), "heardLang": fc.args.get("lang")})
            t_api = time.perf_counter()
            view = svc.turn("spike", sid, f"spike-turn-{i:04d}", fc.args.get("heard_text") or student, None, "voice")
            rec.update({"apiMs": int((time.perf_counter() - t_api) * 1000), "label": view["route"]["label"],
                        "next": view["node"], "done": view["done"]})
            brief = brief_for_voice(view)
            t_resp = time.perf_counter()
            await session.send_tool_response(function_responses=[
                types.FunctionResponse(id=fc.id, name=fc.name, response={"brief": brief})])
            spoken = {}
            await speak_and_listen(brief["say"], t_resp, spoken)
            rec.update({"kikiSaid": spoken["spoken"], "expected": brief["say"], "verbatim": spoken["verbatim"],
                        "firstAudioAfterToolMs": spoken["firstAudioMs"]})
            leaks = svc.speech("spike", sid, spoken["spoken"] or "-")["leaks"] if not view["done"] else []
            rec["leaks"] = leaks
            report["turns"].append(rec)
            if view["done"]:
                break
    for r in report["turns"]:
        print(json.dumps(r, ensure_ascii=False))
    if a.out:
        Path(a.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--question", default="ece-phase-error")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--say", action="append", required=True)
    ap.add_argument("--audio", action="store_true")
    ap.add_argument("--live-model", default="gemini-3.8-live")
    ap.add_argument("--classifier", default="gemini-3.5-flash-lite")
    ap.add_argument("--out")
    ap.add_argument("--save-audio", help="folder for KiKi's spoken audio (24 kHz WAV) per turn")
    sys.exit(asyncio.run(main(ap.parse_args())))
