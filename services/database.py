from contextlib import contextmanager

from functools import lru_cache
from threading import Lock
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from config.settings import DB_NAME, database_url
from models.database_models import Base


class DatabaseConnectionError(RuntimeError):
    pass


_schema_ready = False
_schema_lock = Lock()


def get_server_engine() -> Engine:
    return create_engine(database_url(include_database=False), pool_pre_ping=True, future=True)


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    url = database_url(include_database=True)
    options = {"sslmode": "require", "connect_timeout": 15} if url.startswith("postgresql") else {}
    return create_engine(url, pool_pre_ping=True, pool_size=3, max_overflow=2,
                         connect_args=options, future=True)


def test_connection() -> tuple[bool, str]:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Koneksi database berhasil."
    except SQLAlchemyError as exc:
        return False, f"Database belum siap: {exc.__class__.__name__}. Periksa XAMPP MySQL, host, port, user, password, dan nama database."


def create_database_if_missing() -> None:
    if get_engine().dialect.name != "mysql":
        return
    with get_server_engine().begin() as connection:
        connection.execute(text(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))


def apply_lightweight_migrations() -> None:
    with get_engine().begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE sanctions ALTER COLUMN tanggal_berakhir_sanksi DROP NOT NULL"))
            connection.execute(text("ALTER TABLE sanctions ALTER COLUMN durasi_sanksi_hari DROP NOT NULL"))
            columns = {column["name"] for column in inspect(connection).get_columns("report_progress")}
            if "keterangan" not in columns:
                connection.execute(text("ALTER TABLE report_progress ADD COLUMN keterangan TEXT NULL"))
            return
        connection.execute(text("ALTER TABLE sanctions MODIFY tanggal_berakhir_sanksi DATE NULL"))
        connection.execute(text("ALTER TABLE sanctions MODIFY durasi_sanksi_hari INT NULL"))
        report_note_column = connection.execute(text("SHOW COLUMNS FROM report_progress LIKE 'keterangan'")).first()
        if report_note_column is None:
            connection.execute(text("ALTER TABLE report_progress ADD COLUMN keterangan TEXT NULL AFTER status_progress"))


def create_tables() -> None:
    global _schema_ready
    with _schema_lock:
        if _schema_ready:
            return
        _initialize_tables()
        _schema_ready = True


def _initialize_tables() -> None:
    try:
        create_database_if_missing()
        Base.metadata.create_all(get_engine())
        apply_lightweight_migrations()
        if get_engine().dialect.name == "postgresql":
            with get_engine().begin() as connection:
                for table in Base.metadata.sorted_tables:
                    connection.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))
    except SQLAlchemyError as exc:
        raise DatabaseConnectionError(
            "Gagal membuat tabel. Periksa koneksi database dan kredensial pada .env."
        ) from exc


@contextmanager
def session_scope():
    SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False, future=True)
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
