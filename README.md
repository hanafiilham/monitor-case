# IR Monitoring Case (IMC)

Aplikasi internal untuk mengelola data sanksi karyawan, master data karyawan, arsip dokumen, progres laporan, dashboard visual, serta export PDF/Excel.

## Fitur Utama

- Login/logout menggunakan PERNER dan password.
- Upload data sanksi dari Excel/CSV.
- Preview, load, transform, edit, dan simpan data sanksi ke MySQL.
- Spreadsheet Transform berbasis Jspreadsheet.
- Master Data Karyawan untuk lookup otomatis dari PERNER.
- Dashboard dinamis dengan filter dan export PDF.
- Progres Laporan dengan status, keterangan, upload rekomendasi, dan export Excel.
- Arsip dokumen dengan preview, download, filter, dan bulk delete.

## Kebutuhan Sistem

- Windows 10/11.
- Python 3.11 sampai 3.14.
- XAMPP dengan MySQL/MariaDB aktif.
- Git.
- Browser modern, disarankan Chrome atau Edge.

## Instalasi

1. Clone repository:

```powershell
git clone https://github.com/hanafiilham/ptsp.git
cd ptsp
```

2. Buat virtual environment:

```powershell
python -m venv .venv
```

3. Aktifkan virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Jika PowerShell menolak aktivasi, jalankan:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

4. Install dependency:

```powershell
pip install -r requirements.txt
```

5. Siapkan file `.env`:

```powershell
copy .env.example .env
```

Contoh isi `.env`:

```env
APP_NAME=SGA Dashboard
APP_ENV=development
SECRET_KEY=ganti_dengan_secret_random_yang_panjang
AUTH_DEFAULT_PERNER=29951
AUTH_DEFAULT_PASSWORD=12345678
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=sga_dashboard
DB_USER=root
DB_PASSWORD=
```

6. Jalankan MySQL dari XAMPP.

Database `sga_dashboard` dan tabel aplikasi akan dibuat otomatis saat aplikasi berjalan.

7. Jalankan aplikasi:

```powershell
python app.py
```

8. Buka browser:

```text
http://127.0.0.1:8501
```

## Login Awal

```text
PERNER: 29951
Password: 12345678
```

Password dapat diubah dari tombol **Ubah Password** di sidebar.

## Menjalankan Dengan Cloudflare Tunnel

Pastikan aplikasi lokal sudah berjalan di:

```text
http://127.0.0.1:8501
```

Lalu jalankan cloudflared:

```powershell
cloudflared tunnel --url http://127.0.0.1:8501
```

Gunakan URL `trycloudflare.com` yang muncul di terminal untuk akses dari device lain.

## Struktur Data

File upload data sanksi dibaca dari sheet dengan pola nama:

```text
Rekap sanksi Jan - Des 2026
```

Sheet lain akan diabaikan.

Kolom utama data sanksi:

- NO
- NOMOR SURAT SANKSI
- TANGGAL MULAI SANKSI
- TANGGAL BERAKHIR SANKSI
- PERNER KARYAWAN
- NAMA KARYAWAN
- JABATAN KARYAWAN
- DEPARTEMEN/SEKSI
- JENIS SANKSI
- URAIAN PELANGGARAN

## Catatan Penyimpanan

- Data sanksi tersimpan ke MySQL pada tabel `sanctions`.
- Batch upload tersimpan ke `upload_batches`.
- Master karyawan tersimpan ke `employee_master`.
- Arsip metadata tersimpan ke `archive_documents`.
- File arsip fisik tersimpan di folder `data/archives`.
- Progres laporan tersimpan ke `report_progress`.

Folder upload, arsip, export, log, dan virtual environment tidak ikut di-commit ke Git.
