import pytest
from services import file_storage as storage
from app import app


def test_file_survives_lost_local_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "BASE_DIR", tmp_path)
    monkeypatch.setattr(storage, "STORAGE_BACKEND", "supabase")
    objects = {}

    def request(method, endpoint, data=None, content_type=None):
        key = endpoint.split("imc-archives/", 1)[-1]
        if method == "POST":
            objects[key] = data
            return b"{}"
        return objects[key]

    monkeypatch.setattr(storage, "_request", request)
    path = tmp_path / "data" / "archives" / "document.pdf"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"PDF data")
    storage.persist_file(path)
    path.unlink()
    assert storage.ensure_file(path)
    assert path.read_bytes() == b"PDF data"


def test_outside_data_cannot_be_downloaded(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "BASE_DIR", tmp_path)
    with pytest.raises(storage.StorageError):
        storage.ensure_file(tmp_path / ".env")


def test_failed_cloud_delete_preserves_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "BASE_DIR", tmp_path)
    monkeypatch.setattr(storage, "STORAGE_BACKEND", "supabase")
    path = tmp_path / "data" / "archives" / "document.pdf"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"PDF data")

    def fail(*args, **kwargs):
        raise storage.StorageError("Network unavailable")

    monkeypatch.setattr(storage, "_request", fail)
    with pytest.raises(storage.StorageError):
        storage.delete_file(path)
    assert path.exists()


def test_render_blocks_unconfigured_access(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.delenv("HOSTING_USERNAME", raising=False)
    monkeypatch.delenv("HOSTING_PASSWORD", raising=False)
    client = app.test_client()
    assert client.get("/").status_code == 503
    assert client.get("/healthz").status_code == 200


def test_hosting_access_protects_frontend_and_api(monkeypatch):
    monkeypatch.setenv("HOSTING_USERNAME", "test-admin")
    monkeypatch.setenv("HOSTING_PASSWORD", "test-password")
    client = app.test_client()
    assert client.get("/").status_code == 401
    assert client.get("/api/archives").status_code == 401
    assert client.get("/", auth=("test-admin", "test-password")).status_code == 200
