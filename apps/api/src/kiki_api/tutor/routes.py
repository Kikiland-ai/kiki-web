from typing import Annotated, Literal

from fastapi import Depends, Header
from pydantic import Field, model_validator

from ..backend import BoundaryError
from ..models import Identity, WireModel
from .service import TutorError


class StartBody(WireModel):
    questionId: str = Field(min_length=1, max_length=64)
    lang: Literal["en", "or"] = "en"


class TurnBody(WireModel):
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    chip: str | None = Field(default=None, min_length=1, max_length=64)
    mode: Literal["text", "voice"] = "text"

    @model_validator(mode="after")
    def one_input(self):
        if (self.text is None) == (self.chip is None):
            raise ValueError("Send exactly one of text or chip")
        return self


class SpeechBody(WireModel):
    text: str = Field(min_length=1, max_length=4000)


def register_tutor_routes(app, identity, backend, call):
    user_dep = Annotated[Identity, Depends(identity)]
    key_dep = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=128)]

    def service():
        tutor = backend().tutor
        if tutor is None:
            raise BoundaryError(503, "Tutor mode is not available.")
        return tutor

    def run(op):
        def guarded():
            try:
                return op()
            except TutorError as exc:     # `call` passes BoundaryError through; anything else is 503
                raise BoundaryError(exc.status, exc.message) from None

        return call(guarded)

    @app.get("/tutor/questions/{question_id}")
    def question(question_id: str, user: user_dep):
        return run(lambda: service().question_view(question_id))

    @app.post("/tutor/sessions", status_code=201)
    def start_session(body: StartBody, user: user_dep, key: key_dep):
        return run(lambda: service().start(user.uid, body.questionId, body.lang, key))

    @app.get("/tutor/sessions/{session_id}")
    def read_session(session_id: str, user: user_dep):
        return run(lambda: service().get(user.uid, session_id))

    @app.post("/tutor/sessions/{session_id}/turns")
    def turn(session_id: str, body: TurnBody, user: user_dep, key: key_dep):
        return run(lambda: service().turn(user.uid, session_id, key, body.text, body.chip, body.mode))

    @app.post("/tutor/sessions/{session_id}/voice-token")
    def voice_token(session_id: str, user: user_dep):
        return run(lambda: service().voice_token(user.uid, session_id))

    @app.get("/tutor/sessions/{session_id}/report")
    def report(session_id: str, user: user_dep):
        return run(lambda: service().report(user.uid, session_id))

    @app.post("/tutor/sessions/{session_id}/speech")
    def speech(session_id: str, body: SpeechBody, user: user_dep):
        return run(lambda: service().speech(user.uid, session_id, body.text))
