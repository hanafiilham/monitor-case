from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from config.settings import DB_NAME, database_url
from models.database_models import Base


class DatabaseConnectionError(RuntimeError):
    pass


def get_server_engine() -> Engine:
    return create_engine(database_url(include_database=False), pool_pre_ping=True, future=True)


def get_engine() -> Engine:
    return create_engine(database_url(include_database=True), pool_pre_ping=True, future=True)


def test_connection() -> tuple[bool, str]:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Koneksi database berhasil."
    except SQLAlchemyError as exc:
        return False, f"Database belum siap: {exc.__class__.__name__}. Periksa XAMPP MySQL, host, port, user, password, dan nama database."


def create_database_if_missing() -> None:
    with get_server_engine().begin() as connection:
        connection.execute(text(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))


def apply_lightweight_migrations() -> None:
    with get_engine().begin() as connection:
        connection.execute(text("ALTER TABLE sanctions MODIFY tanggal_berakhir_sanksi DATE NULL"))
        connection.execute(text("ALTER TABLE sanctions MODIFY durasi_sanksi_hari INT NULL"))
        report_note_column = connection.execute(text("SHOW COLUMNS FROM report_progress LIKE 'keterangan'")).first()
        if report_note_column is None:
            connection.execute(text("ALTER TABLE report_progress ADD COLUMN keterangan TEXT NULL AFTER status_progress"))


def create_tables() -> None:
    try:
        create_database_if_missing()
        Base.metadata.create_all(get_engine())
        apply_lightweight_migrations()
    except SQLAlchemyError as exc:
        raise DatabaseConnectionError(
            "Gagal membuat tabel. Pastikan MySQL XAMPP aktif dan kredensial .env benar."
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
