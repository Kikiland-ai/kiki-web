"""Bounded original inspection only. No text extraction, OCR or lesson generation."""

import hashlib
import logging
import re
import warnings
from dataclasses import dataclass
from typing import BinaryIO

from PIL import Image
from pypdf import PdfReader
from starlette.datastructures import UploadFile

from .backend import BoundaryError
from .material_models import MAX_FILE_BYTES

# pypdf diagnostics can include document content; keep untrusted files out of API logs.
pdf_logger = logging.getLogger("pypdf")
pdf_logger.addHandler(logging.NullHandler())
pdf_logger.propagate = False


@dataclass
class InspectedFile:
    title: str
    mime: str
    size: int
    sha256: str
    stream: BinaryIO


def inspect_file(upload: UploadFile) -> InspectedFile:
    title = re.sub(
        r"[\x00-\x1f\x7f]", "", (upload.filename or "").replace("\\", "/").split("/")[-1]
    )
    if not title.strip() or len(title) > 240:
        raise BoundaryError(422, "Use a file name between 1 and 240 characters.")
    mime = upload.content_type
    if mime not in {"application/pdf", "image/jpeg", "image/png"}:
        raise BoundaryError(422, "Choose PDF, JPEG or PNG files.")
    stream = upload.file
    stream.seek(0)
    digest, size = hashlib.sha256(), 0
    while chunk := stream.read(64 * 1024):
        size += len(chunk)
        if size > MAX_FILE_BYTES:
            raise BoundaryError(413, "Each original must be no larger than 10 MB.")
        digest.update(chunk)
    if not size:
        raise BoundaryError(422, "Choose non-empty files.")
    stream.seek(0)
    try:
        header = stream.read(8)
        stream.seek(0)
        if mime == "application/pdf":
            if not header.startswith(b"%PDF-"):
                raise ValueError("Header mismatch")
            reader = PdfReader(stream, strict=True)
            if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
                raise ValueError("Encrypted, empty or oversized page tree")
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                image = Image.open(stream)
                if image.format != ("PNG" if mime == "image/png" else "JPEG"):
                    raise ValueError("Format mismatch")
                if image.width * image.height > 40_000_000:
                    raise ValueError("Too many pixels")
                image.verify()
    except Exception:
        raise BoundaryError(
            422,
            "A file could not be validated. Use readable, unencrypted PDFs (up to 500 pages) "
            "or valid JPEG/PNG images (up to 40 megapixels).",
        ) from None
    finally:
        stream.seek(0)
    return InspectedFile(title, mime, size, digest.hexdigest(), stream)
