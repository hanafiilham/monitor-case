from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sheet_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mode: Mapped[str] = mapped_column(String(40), nullable=False, default="append")
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    sanctions = relationship("Sanction", back_populates="upload_batch")


class Sanction(Base):
    __tablename__ = "sanctions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_batch_id: Mapped[int] = mapped_column(ForeignKey("upload_batches.id"), nullable=False)
    nomor_surat_sanksi: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    tanggal_mulai_sanksi: Mapped[object] = mapped_column(Date, nullable=False)
    tanggal_berakhir_sanksi: Mapped[object | None] = mapped_column(Date, nullable=True)
    perner_karyawan: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    nama_karyawan: Mapped[str] = mapped_column(String(180), nullable=False)
    jabatan_karyawan: Mapped[str] = mapped_column(String(180), nullable=True)
    departemen_seksi: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    jenis_sanksi: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    uraian_pelanggaran: Mapped[str] = mapped_column(Text, nullable=True)
    durasi_sanksi_hari: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status_sanksi: Mapped[str] = mapped_column(String(40), nullable=False)
    bulan_sanksi: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tahun_sanksi: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    periode_sanksi: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    upload_batch = relationship("UploadBatch", back_populates="sanctions")


class ValidationError(Base):
    __tablename__ = "validation_errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_batch_id: Mapped[int | None] = mapped_column(ForeignKey("upload_batches.id"), nullable=True)
    excel_row: Mapped[int] = mapped_column(Integer, nullable=False)
    column_name: Mapped[str] = mapped_column(String(180), nullable=False)
    original_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_type: Mapped[str] = mapped_column(String(120), nullable=False)
    suggestion: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class AppUser(Base):
    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    perner: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ArchiveDocument(Base):
    __tablename__ = "archive_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    extension: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    mime_type: Mapped[str] = mapped_column(String(180), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False, index=True)

class EmployeeMasterBatch(Base):
    __tablename__ = "employee_master_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mode: Mapped[str] = mapped_column(String(40), nullable=False, default="update")
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class EmployeeMaster(Base):
    __tablename__ = "employee_master"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    perner_karyawan: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    nama_karyawan: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    jabatan_karyawan: Mapped[str] = mapped_column(String(180), nullable=True)
    departemen_seksi: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    status_karyawan: Mapped[str] = mapped_column(String(40), nullable=False, default="Aktif", index=True)
    source_batch_id: Mapped[int | None] = mapped_column(ForeignKey("employee_master_batches.id"), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class SanctionDurationMaster(Base):
    __tablename__ = "sanction_duration_master"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    jenis_sanksi: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    durasi_hari: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    keterangan: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_batch_id: Mapped[int | None] = mapped_column(ForeignKey("employee_master_batches.id"), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ReportProgress(Base):
    __tablename__ = "report_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nomor_laporan: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True)
    departemen: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    tanggal_laporan: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    jenis_laporan: Mapped[str] = mapped_column(Text, nullable=False)
    status_progress: Mapped[str] = mapped_column(String(50), nullable=False, default="laporan_masuk", index=True)
    keterangan: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
