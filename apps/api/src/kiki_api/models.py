from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)


class SupportRating(WireModel):
    language: Literal["or", "en"]
    outOf10: int = Field(ge=1, le=10)


class SelfRatings(WireModel):
    support: SupportRating
    englishOutOf10: int = Field(ge=1, le=10)
    assessedBy: Literal["self"]


class Onboarding(WireModel):
    step: int = Field(ge=0, le=3)
    completedAt: str | None
    fluencySelfRatings: SelfRatings | None
    easyLanguageAnswer: Literal["regional", "mixed", "english"] | None

    @field_validator("completedAt")
    @classmethod
    def valid_completion_time(cls, value: str | None) -> str | None:
        if value is not None:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("Completion timestamp needs a timezone")
        return value

    @model_validator(mode="after")
    def consistent_steps(self):
        if self.step >= 2 and self.fluencySelfRatings is None:
            raise ValueError("Confidence preferences are required for this step")
        if self.step == 3 and self.easyLanguageAnswer is None:
            raise ValueError("Language preference is required for confirmation")
        if self.completedAt is not None and self.step != 3:
            raise ValueError("Only confirmed onboarding can be complete")
        return self


class Preferences(WireModel):
    supportLanguage: Literal["or", "en"]
    dialLevel: int = Field(ge=1, le=5)
    onboarding: Onboarding

    @model_validator(mode="after")
    def same_rating_language(self):
        ratings = self.onboarding.fluencySelfRatings
        if ratings and ratings.support.language != self.supportLanguage:
            raise ValueError("Confidence language must match the learning language")
        return self


class Profile(Preferences):
    schema_: Literal["profile/v1"] = Field(alias="schema")
    id: str = Field(min_length=1, max_length=128)
    displayName: str = Field(min_length=1, max_length=120)
    courseIds: list[str]

    @field_validator("courseIds")
    @classmethod
    def unique_courses(cls, courses: list[str]) -> list[str]:
        if len(set(courses)) != len(courses) or any(not value for value in courses):
            raise ValueError("Enrollment IDs must be unique and nonempty")
        return courses


class ProfileEnvelope(WireModel):
    profile: Profile


class Enrollment(WireModel):
    courseId: Literal["CRS-AC-ECE"]
    semester: int = Field(ge=1, le=8)


class Identity(WireModel):
    uid: str = Field(min_length=1, max_length=128, pattern=r"^[^/]+$")
    display_name: str = "Student"


def wire(profile: Profile) -> dict:
    return profile.model_dump(mode="json", by_alias=True)


def new_profile(identity: Identity) -> Profile:
    return Profile(
        schema="profile/v1",
        id=identity.uid,
        displayName=(identity.display_name.strip() or "Student")[:120],
        supportLanguage="or",
        dialLevel=2,
        courseIds=[],
        onboarding=Onboarding(
            step=0, completedAt=None, fluencySelfRatings=None, easyLanguageAnswer=None
        ),
    )


def saved_preferences(current: Profile, update: Preferences) -> dict:
    data = update.model_dump(mode="json")
    if update.onboarding.completedAt is not None:
        data["onboarding"]["completedAt"] = current.onboarding.completedAt or datetime.now(
            UTC
        ).isoformat().replace("+00:00", "Z")
    return data
