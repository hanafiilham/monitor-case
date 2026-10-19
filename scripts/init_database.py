"""Create application tables using the configured database."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if __name__ == "__main__":
    try:
        from services.database import create_tables

        create_tables()
        print("Database schema ready.")
    except ModuleNotFoundError as exc:
        print("Database initialization failed: missing module:", exc.name, flush=True)
        print("Install requirements-prod.txt during Azure build, then redeploy.", flush=True)
        sys.exit(1)
    except Exception as exc:
        print("Database initialization failed:", type(exc).__name__)
        sys.exit(1)
