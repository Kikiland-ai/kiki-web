"""Validate locally by default. --apply imports only this authored catalog, never learners."""

import argparse
from pathlib import Path

from dotenv import load_dotenv

from kiki_api.backend import firebase_services
from kiki_api.config import Settings
from kiki_api.learning_catalog import build_catalog, import_catalog

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-current")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    catalog = build_catalog(
        root / "data-model/ledgers/electronics/analog-modulation.json",
        root / "data-model/cases/analog-modulation-odia.json",
    )
    print(f"Validated {catalog.version}: {len(catalog.documents)} content documents.")
    print("Ten lessons, 40 placards, 30 terms, 11 private assessment sets; no learner seeds.")
    if args.apply:
        load_dotenv(".env.local", override=False)
        services = firebase_services(Settings())
        outcome = import_catalog(services.profiles.client, catalog, args.expected_current)
        print(f"Firestore catalog {outcome}. No learner records were written.")
    else:
        print("Dry run only. No credentials loaded or database writes performed.")
