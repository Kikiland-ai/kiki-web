"""Cloud Run process: explicit settings, one worker and platform PORT."""

import os

import uvicorn


def main():
    # The composition root remains the same authenticated API used in local tests.
    # No env file is copied into the image; secrets enter at runtime only.
    uvicorn.run(
        "kiki_api.main:app",
        factory=True,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8080")),
        workers=1,
        access_log=False,
    )


if __name__ == "__main__":
    main()
