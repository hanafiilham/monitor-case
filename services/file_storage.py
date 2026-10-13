"""Private object storage with a local cache for spreadsheet readers."""
import json
import mimetypes
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from config.settings import BASE_DIR, STORAGE_BACKEND, SUPABASE_BUCKET, SUPABASE_SECRET_KEY, SUPABASE_URL


class StorageError(RuntimeError):
    pass


def object_key(path: Path) -> str:
    try:
        return path.resolve().relative_to((BASE_DIR / "data").resolve()).as_posix()
    except ValueError:
        raise StorageError("Lokasi file berada di luar folder data.") from None


def _request(method: str, endpoint: str, data=None, content_type=None) -> bytes:
    if not SUPABASE_URL.startswith("https://") or not SUPABASE_SECRET_KEY:
        raise StorageError("Isi SUPABASE_URL dan SUPABASE_SECRET_KEY pada konfigurasi server.")
    headers = {"apikey": SUPABASE_SECRET_KEY}
    if not SUPABASE_SECRET_KEY.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {SUPABASE_SECRET_KEY}"
    if content_type:
        headers["Content-Type"] = content_type
    if method == "POST":
        headers["x-upsert"] = "true"
    req = Request(f"{SUPABASE_URL}/storage/v1/{endpoint}", data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=120) as response:
            return response.read()
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read())
        except (ValueError, OSError):
            payload = {}
        if exc.code == 404 or str(payload.get("statusCode")) == "404":
            if method == "DELETE":
                return b"{}"
            raise FileNotFoundError("File tidak ditemukan pada Supabase Storage.") from None
        raise StorageError(f"Supabase Storage gagal (HTTP {exc.code}). Periksa bucket dan secret key.") from None
    except URLError:
        raise StorageError("Tidak dapat terhubung ke Supabase Storage.") from None


def persist_file(path: Path) -> None:
    if STORAGE_BACKEND != "supabase":
        return
    key = object_key(path)
    if path.stat().st_size > 50 * 1024 * 1024:
        raise StorageError("Ukuran file melebihi batas Supabase Free 50 MB.")
    _request("POST", f"object/{quote(SUPABASE_BUCKET, safe='')}/{quote(key, safe='/')}",
             path.read_bytes(), mimetypes.guess_type(path.name)[0] or "application/octet-stream")


def ensure_file(path: Path) -> bool:
    key = object_key(path)
    if path.exists():
        return True
    if STORAGE_BACKEND != "supabase":
        return False
    try:
        data = _request("GET", f"object/authenticated/{quote(SUPABASE_BUCKET, safe='')}/{quote(key, safe='/')}")
    except FileNotFoundError:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def delete_file(path: Path) -> None:
    key = object_key(path)
    if STORAGE_BACKEND == "supabase":
        _request("DELETE", f"object/{quote(SUPABASE_BUCKET, safe='')}",
                 json.dumps({"prefixes": [key]}).encode(), "application/json")
    path.unlink(missing_ok=True)
