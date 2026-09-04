from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
import os


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

APP_TITLE = "PT WKS Industrial Relations"
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
AUTH_DEFAULT_PERNER = os.getenv("AUTH_DEFAULT_PERNER", "29951")
AUTH_DEFAULT_PASSWORD = os.getenv("AUTH_DEFAULT_PASSWORD", "12345678")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "sga_dashboard")
DB_USER = os.getenv("DB_USER", "sga_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "change_me")

UPLOAD_DIR = BASE_DIR / "data" / "uploads"
TRANSFORMED_DIR = BASE_DIR / "data" / "transformed"
EXPORT_DIR = BASE_DIR / "data" / "exports"
ARCHIVE_DIR = BASE_DIR / "data" / "archives"
SAMPLE_DIR = BASE_DIR / "data" / "sample"
LOG_DIR = BASE_DIR / "logs"
LOG_FILE = LOG_DIR / "application.log"

for directory in (UPLOAD_DIR, TRANSFORMED_DIR, EXPORT_DIR, ARCHIVE_DIR, SAMPLE_DIR, LOG_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def database_url(include_database: bool = True) -> str:
    password = quote_plus(DB_PASSWORD)
    database = f"/{DB_NAME}" if include_database else ""
    return f"mysql+pymysql://{DB_USER}:{password}@{DB_HOST}:{DB_PORT}{database}?charset=utf8mb4"

