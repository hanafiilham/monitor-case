"""Check database connectivity without printing credentials or creating tables."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from config.settings import database_url


def main() -> int:
    try:
        url = make_url(database_url())
        if not url.password or url.password == "[YOUR-PASSWORD]":
            print("Database password is missing or still uses a placeholder.")
            return 1
        options = {"connect_timeout": 10}
        if url.get_backend_name() == "postgresql":
            options["sslmode"] = "require"
        engine = create_engine(url, connect_args=options)
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                print("Database connection: OK")
                print("Database type:", connection.dialect.name)
        finally:
            engine.dispose()
        return 0
    except Exception as exc:
        print("Database connection failed:", type(exc).__name__)
        print("Check DATABASE_URL, the encoded password, driver installation, and network access.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
