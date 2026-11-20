"""Build the tutor from settings. A tutor failure must never take the rest of the API down."""

import logging

from ..config import Settings

logger = logging.getLogger("kiki_api.tutor")
STATUS: dict = {"enabled": False, "reason": "not configured"}


def build_tutor(settings: Settings, client, store=None):
    """Return a TutorService, or None (tutor routes answer 503) with the reason in STATUS."""
    STATUS.clear()
    if not settings.tutor_enabled:
        STATUS.update(enabled=False, reason="KIKI_TUTOR_ENABLED is off")
        return None
    try:
        from .analysis import GeminiSummarizer
        from .classifier import GeminiClassifier
        from .service import TutorService, load_questions
        from .store import FirestoreTutorStore
        from .voice import VoiceTokens

        from .keys import KeyPool

        pool = KeyPool.from_config(settings.gemini_keys_raw())    # one shared pool: health is shared
        questions = load_questions()
        if not questions:
            raise ValueError("no tutor questions found")
        tutor = TutorService(
            questions,
            GeminiClassifier(pool, settings.tutor_classifier_model, retries_on_429=1),
            store or FirestoreTutorStore(client),
            GeminiSummarizer(pool, settings.tutor_classifier_model),
            voice=VoiceTokens(pool, settings.tutor_live_model, probe_model=settings.tutor_classifier_model),
        )
    except Exception as exc:  # noqa: BLE001 - isolate: profiles, lessons and labs keep working
        logger.error("Tutor disabled at startup (%s: %s)", type(exc).__name__, str(exc)[:200])
        STATUS.update(enabled=False, reason=f"startup failed: {type(exc).__name__}")
        return None
    STATUS.update(
        enabled=True, reason="ok", questions=sorted(questions), keys=len(pool), quotaPools=len(pool.pools),
        classifierModel=settings.tutor_classifier_model, liveModel=settings.tutor_live_model,
    )
    return tutor
