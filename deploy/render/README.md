# Render + Supabase

Flask and frontend run on Render. Supabase PostgreSQL stores records, and the
private bucket stores documents, staging uploads and transformed workbooks.
Local files on Render are only a disposable cache.

## Configure locally

Add to `.env`. Keep the existing DB_* values for the old local MariaDB database:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres
STORAGE_BACKEND=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
SUPABASE_BUCKET=imc-archives
```

Use Connect > Session Pooler for DATABASE_URL. Percent-encode special password
characters. Get Project URL and secret key from Settings > API Keys. Legacy
service_role keys are supported. Never use the publishable/anon key as the server
key. Bucket `imc-archives` must be private. Never commit `.env` or database dumps.

## Migrate data

Keep local MySQL running. Inspect source row counts first (no writes):

```powershell
.\.venv\Scripts\python.exe scripts\migrate_to_supabase.py
```

Then copy to an empty destination and upload existing documents:

```powershell
.\.venv\Scripts\python.exe scripts\migrate_to_supabase.py --apply
.\.venv\Scripts\python.exe scripts\upload_existing_files.py
```

Migration preserves IDs and relationships, refuses a nonempty destination, and
leaves the local source unchanged. If you have no old data, initialize only tables:

```powershell
.\.venv\Scripts\python.exe scripts\init_database.py
```

PostgreSQL application tables have RLS enabled, without public Data API policies.
Access is through Flask using the server database credentials.

## Deploy

1. Commit and push source code including render.yaml to GitHub.
2. Sign in to Render with GitHub, select New > Blueprint, connect the repository.
3. Choose Free and fill DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY,
   HOSTING_USERNAME and HOSTING_PASSWORD. Use a strong hosting password.
4. Deploy and open the HTTPS onrender.com URL. The browser asks for hosting
   credentials; no internal login/change-password screen is restored.

For New > Web Service, manually use:

```text
Build: pip install -r requirements-prod.txt
Start: python scripts/init_database.py && gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 300
Health check: /healthz
```

Set STORAGE_BACKEND=supabase, SUPABASE_BUCKET=imc-archives, APP_DEBUG=false and
PYTHON_VERSION=3.12.8 plus the private variables above. Missing hosting credentials
block application access on Render; the health check remains public.

## Verification and limits

Test employee lookup, report create/update, archive upload/preview/download,
spreadsheet save and Excel/PDF exports. Restart Render and download an archive
again to confirm persistence. Upload limit is 50 MB including multipart overhead.
Large Excel processing may exceed Render Free RAM. Supabase Free can pause
inactive projects and has quotas; Render sleeps when idle. Keep independent
backups and remove obsolete staging files periodically.

Preparing local source does not publish the application. Deployment and live
Storage verification require your account and private environment values.
