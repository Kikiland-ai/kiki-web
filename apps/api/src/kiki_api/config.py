import os
from typing import Literal
from urllib.parse import urlparse

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="KIKI_", env_file=".env.local", extra="ignore", frozen=True
    )
    firebase_project_id: str
    firestore_database: str = "(default)"
    storage_bucket: str | None = None
    # Private bucket holding published lesson media; unset keeps lessons text-only.
    media_bucket: str | None = None
    lab_execution_mode: Literal["disabled", "local", "cloud"] = "disabled"
    lab_backend_origin: str | None = None
    lab_proxy_secret: SecretStr | None = None
    environment: Literal["cloud", "emulator"] = "cloud"
    cors_origins: list[str] = ["http://127.0.0.1:5174", "http://localhost:5174"]

    @model_validator(mode="after")
    def lab_upstream(self):
        if self.lab_execution_mode == "disabled":
            return self
        origin = urlparse(self.lab_backend_origin or "")
        local = self.lab_execution_mode == "local"
        if (
            origin.scheme != ("http" if local else "https")
            or not origin.hostname
            or origin.username
            or origin.password
            or origin.path
            or origin.query
            or origin.fragment
            or (local and self.lab_backend_origin != "http://127.0.0.1:8100")
            or (not local and origin.hostname in {"localhost", "127.0.0.1", "::1"})
        ):
            raise ValueError(
                "Configure an exact HTTPS lab origin or the approved local :8100 origin"
            )
        if (
            not self.lab_proxy_secret
            or not 32 <= len(self.lab_proxy_secret.get_secret_value()) <= 256
        ):
            raise ValueError("Lab proxy secret must contain 32–256 characters")
        return self

    @field_validator("storage_bucket", "media_bucket")
    @classmethod
    def valid_bucket(cls, value):
        if value is not None and (not value or "/" in value or ":" in value or " " in value):
            raise ValueError("Use a bucket name without gs:// or a path")
        return value

    @field_validator("firebase_project_id")
    @classmethod
    def valid_project(cls, value: str) -> str:
        if not value or not all(c.islower() or c.isdigit() or c == "-" for c in value):
            raise ValueError("Use a Firebase project ID")
        return value

    @field_validator("cors_origins")
    @classmethod
    def exact_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            url = urlparse(origin)
            if (
                url.scheme not in {"http", "https"}
                or not url.netloc
                or url.username
                or url.password
                or url.path
                or url.query
                or url.fragment
                or "*" in origin
            ):
                raise ValueError("CORS origins must be explicit origins without paths or wildcards")
        return origins

    @model_validator(mode="after")
    def emulator_separation(self):
        hosts = [os.getenv("FIREBASE_AUTH_EMULATOR_HOST"), os.getenv("FIRESTORE_EMULATOR_HOST")]
        if os.getenv("STORAGE_EMULATOR_HOST") or os.getenv("FIREBASE_STORAGE_EMULATOR_HOST"):
            raise ValueError("Storage emulator is not supported by this cloud-originals boundary")
        if self.environment == "cloud":
            if any(hosts) or self.firebase_project_id.startswith("demo-"):
                raise ValueError("Cloud mode cannot use emulator hosts or a demo project")
        else:
            if self.firebase_project_id != "demo-kiki-local" or not all(hosts):
                raise ValueError("Emulator mode needs demo-kiki-local and both local SDK hosts")
            for host in hosts:
                url = urlparse("http://" + host)
                if (
                    url.hostname not in {"localhost", "127.0.0.1"}
                    or not url.port
                    or url.username
                    or url.password
                    or url.path
                    or url.query
                    or url.fragment
                ):
                    raise ValueError("Emulator SDK hosts must be localhost:port without a scheme")
        return self
