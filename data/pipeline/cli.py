from __future__ import annotations

import argparse

from dotenv import load_dotenv

load_dotenv()

from data.pipeline.build import build_dashboard  # noqa: E402
from data.pipeline.config import settings  # noqa: E402
from data.pipeline.extract import fetch_sources  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="EV analytics data pipeline")
    parser.add_argument("command", choices=["fetch", "build", "all"])
    args = parser.parse_args()

    if args.command in {"fetch", "all"}:
        for path in fetch_sources(settings):
            print(f"Fetched {path}")
    if args.command in {"build", "all"}:
        print(f"Built {build_dashboard(settings)}")


if __name__ == "__main__":
    main()

