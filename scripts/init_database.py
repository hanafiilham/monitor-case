"""Create application tables using the configured database."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from services.database import create_tables

if __name__ == "__main__":
    try:
        create_tables()
        print("Database schema ready.")
    except Exception as exc:
        print("Database initialization failed:", type(exc).__name__)
        sys.exit(1)
