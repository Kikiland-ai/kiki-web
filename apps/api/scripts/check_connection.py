"""Use normal SDK credentials; never print tokens or inspect credential-file contents."""

from dotenv import load_dotenv

from kiki_api.backend import firebase_services
from kiki_api.config import Settings


def main():
    try:
        load_dotenv(".env.local", override=False)
        settings = Settings()
        services = firebase_services(settings)
        # Read a deliberately nonexistent probe; no student content or writes.
        services.profiles.client.collection("learners").document(
            "kiki-connection-probe-no-record"
        ).get(timeout=5)
        print("Firebase Admin credentials and Firestore read access are available.")
        print("This does not yet prove a signed-in browser/profile round trip.")
    except Exception as error:
        print(f"Firebase profile connection unavailable ({type(error).__name__}).")
        print("See README.md for ADC/database setup. No credentials were printed.")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
