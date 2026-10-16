"""Versioned catalog import from authored JSON. Never import synthetic learner seeds."""

import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path

from firebase_admin import firestore

from .backend import BoundaryError
from .learning_models import COURSE, LAB_CONCEPTS, PLAN, Chapter, Lesson, Question, Term


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()


def dump(value):
    return value.model_dump(mode="json", by_alias=True, exclude_none=True)


@dataclass
class CatalogImport:
    version: str
    documents: dict[str, dict]
    manifest: dict


def build_catalog(ledger_path: Path, case_path: Path) -> CatalogImport:
    ledger = json.loads(ledger_path.read_text())
    case = json.loads(case_path.read_text())
    # Only authored fields influence content identity. Preview seeds never enter any write.
    case = {k: v for k, v in case.items() if k != "seeds"}
    if (
        ledger["lessonPlan"]["id"] != PLAN
        or ledger["course"]["id"] != COURSE
        or case["lessonPlanId"] != PLAN
        or case["practical"]["requiredConceptIds"] != LAB_CONCEPTS
    ):
        raise ValueError("Unsupported learning case or prerequisites")
    version = "am-" + digest({"projectionSchema": 1, "ledger": ledger, "case": case})[:24]
    root = f"learningCatalog/{PLAN}/versions/{version}"
    documents = {}
    translations = {t["conceptId"]: t for t in case["conceptTranslations"] if t["language"] == "or"}
    examples = {t["termId"]: t["sentence"] for t in case["glossaryExamples"]}
    assessments = {a["conceptIds"][0]: a["id"] for a in case["assessments"]["concepts"]}
    terms = {}
    for t in ledger["terms"]:
        terms[t["id"]] = dump(
            Term(
                id=t["id"],
                term=t["term"],
                definition=t["definition"],
                pronunciationOr=t["pronunciations"]["or"],
                glossOr=t["glosses"]["or"],
                example=examples[t["id"]],
            )
        )
        documents[f"{root}/terms/{t['id']}"] = {"source": deepcopy(t), "view": terms[t["id"]]}
    bilingual = lambda en, regional: {"en": en, "or": regional or en}  # noqa: E731
    chapter = dump(
        Chapter.model_validate(
            {
                "planId": PLAN,
                "courseId": COURSE,
                "title": bilingual(ledger["lessonPlan"]["title"], None),
                "broadConcepts": [
                    {"id": b["id"], "title": bilingual(b["title"], None), "order": b["order"]}
                    for b in ledger["broadConcepts"]
                ],
                "concepts": [
                    {
                        **{
                            k: c[k]
                            for k in [
                                "id",
                                "order",
                                "broadConceptId",
                                "canDo",
                                "prerequisiteIds",
                                "estMinutes",
                            ]
                        },
                        "title": bilingual(c["title"], translations[c["id"]]["title"]),
                        "requiredForLab": c["id"] in LAB_CONCEPTS,
                        "assessmentId": assessments[c["id"]],
                    }
                    for c in ledger["concepts"]
                ],
                "chapterAssessmentId": case["assessments"]["chapter"]["id"],
                "practicalId": case["practicalId"],
                "review": {
                    "content": case["contentReview"]["status"],
                    "odia": "reviewed" if case["odiaReview"]["nativeSpeakerReviewed"] else "draft",
                },
            }
        )
    )
    documents[f"{root}/chapters/{PLAN}"] = chapter
    kinds = ["definition", "concept", "application", "recap"]
    for c in ledger["concepts"]:
        regional = translations[c["id"]]
        cards = sorted(
            (p for p in case["placards"] if p["conceptId"] == c["id"]),
            key=lambda p: kinds.index(p["kind"]),
        )
        cards = [
            {k: p[k] for k in ["id", "kind", "title", "body", "termIds", "sources"]} for p in cards
        ]
        term_ids = list(dict.fromkeys([*c["termIds"], *(t for p in cards for t in p["termIds"])]))
        lesson = Lesson.model_validate(
            {
                "conceptId": c["id"],
                "planId": PLAN,
                "title": bilingual(c["title"], regional["title"]),
                "keyIdea": bilingual(c["explanation"]["keyIdea"], cards[0]["body"]["or"]),
                "placards": cards,
                "terms": [terms[t] for t in term_ids],
                "example": {
                    k: bilingual(c["example"][k], regional["example"][k])
                    for k in ["title", "scenario", "takeaway"]
                },
                "media": {"status": "none"},
                "assessmentId": assessments[c["id"]],
            }
        )
        documents[f"{root}/lessons/{c['id']}"] = dump(lesson)
        # Full original authored sections remain privately available for later modes.
        documents[f"{root}/sourceConcepts/{c['id']}"] = deepcopy(c)
    questions = {q["id"]: (c["id"], q) for c in ledger["concepts"] for q in c["checks"]}
    qt = {q["questionId"]: q for q in case["questionTranslations"] if q["language"] == "or"}
    for a in [*case["assessments"]["concepts"], case["assessments"]["chapter"]]:
        selected = []
        for qid in a["questionIds"]:
            cid, q = questions[qid]
            if q["type"] != "mcq" or q["answer"] not in q["options"]:
                raise ValueError("Assigned questions must have a valid MCQ answer")
            public = dump(
                Question(
                    questionId=qid,
                    conceptId=cid,
                    prompt=bilingual(q["prompt"], qt[qid]["prompt"]),
                    options={"en": q["options"], "or": qt[qid]["options"]},
                )
            )
            selected.append(
                {
                    **public,
                    "correctIndex": q["options"].index(q["answer"]),
                    "explanation": bilingual(q["explanation"], qt[qid]["explanation"]),
                }
            )
        total = 5 if a["scope"] == "concept" else 10
        if (
            len(selected) != total
            or a["passPercent"] != (60 if total == 5 else 80)
            or len({q["questionId"] for q in selected}) != total
            or (total == 10 and len({q["conceptId"] for q in selected}) != 10)
        ):
            raise ValueError("Assessment count, coverage or threshold mismatch")
        documents[f"{root}/privateAssessments/{a['id']}"] = {
            "assessmentId": a["id"],
            "scope": a["scope"],
            "passPercent": a["passPercent"],
            "questions": selected,
        }
    documents[f"{root}/courses/{COURSE}"] = ledger["course"]
    documents[f"{root}/practicals/{case['practicalId']}"] = {
        "ledger": ledger["practicals"][0],
        "case": case["practical"],
    }
    documents[f"{root}/sourceSections/ledger"] = {
        k: v for k, v in ledger.items() if k not in {"concepts", "terms", "practicals", "course"}
    }
    documents[f"{root}/sourceSections/case"] = {
        k: v for k, v in case.items() if k not in {"placards", "practical"}
    }
    # Includes original placards for lossless authoring reconstruction without seeds.
    documents[f"{root}/sourceSections/placards"] = {"placards": case["placards"]}
    manifest = {
        "schema": "learning-catalog/v1",
        "contentVersion": version,
        "planId": PLAN,
        "courseId": COURSE,
        "review": chapter["review"],
        "payloadHash": digest(documents),
        "sourceHashes": {"ledger": digest(ledger), "caseWithoutSeeds": digest(case)},
        "documentCount": len(documents) + 1,
    }
    documents[root] = manifest
    for path, data in documents.items():
        # Conservative JSON budget, below Firestore's 1 MiB document limit including metadata.
        if len(json.dumps(data, ensure_ascii=False).encode()) > 700_000:
            raise ValueError(f"Catalog document needs splitting: {path}")
    if len(documents) > 450:
        raise ValueError("Catalog import needs a staged migration")
    return CatalogImport(version, documents, manifest)


def import_catalog(client, catalog: CatalogImport, expected_current: str | None = None):
    """Atomic activation; immutable version creation; no student records touched."""
    head_ref = client.document(f"learningCatalog/{PLAN}")
    version_ref = head_ref.collection("versions").document(catalog.version)

    @firestore.transactional
    def apply(transaction):
        head = head_ref.get(transaction=transaction, timeout=10)
        saved = version_ref.get(transaction=transaction, timeout=10)
        current = head.to_dict().get("currentVersion") if head.exists else None
        if saved.exists and saved.to_dict() != catalog.manifest:
            raise BoundaryError(409, "An immutable catalog version already has different content.")
        if current == catalog.version and saved.exists:
            return "unchanged"
        if current != expected_current:
            raise BoundaryError(409, "Catalog changed. Inspect its version before activation.")
        if not saved.exists:
            for path, data in catalog.documents.items():
                transaction.create(client.document(path), data)
        transaction.set(
            head_ref,
            {"schema": "learning-catalog-head/v1", "currentVersion": catalog.version},
            merge=True,
        )
        return "activated"

    return apply(client.transaction(max_attempts=3))
