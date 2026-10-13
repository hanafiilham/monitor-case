"""Upload local application files to the configured private Supabase bucket."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config.settings import BASE_DIR, STORAGE_BACKEND
from services.file_storage import persist_file

if __name__ == "__main__":
    if STORAGE_BACKEND != "supabase":
        sys.exit("Set STORAGE_BACKEND=supabase first.")
    try:
        count = 0
        for folder in ("archives", "uploads", "transformed"):
            for path in (BASE_DIR / "data" / folder).rglob("*"):
                if path.is_file():
                    persist_file(path)
                    count += 1
        print("Uploaded files:", count)
    except Exception as exc:
        print("Upload failed:", type(exc).__name__)
        sys.exit(1)
