# Deploy ke Oracle Cloud Always Free

Panduan ini menggunakan Ubuntu 24.04, MariaDB, Gunicorn, dan Nginx. Gunicorn hanya mendengarkan `127.0.0.1:8501`; trafik publik masuk melalui Nginx pada port 80/443.

## 1. Buat VM Oracle Cloud

1. Buka Oracle Cloud Console, lalu **Compute > Instances > Create instance**.
2. Nama instance: `imc-server`.
3. Image: **Ubuntu 24.04**.
4. Shape: pilih yang berlabel **Always Free eligible**. Ampere A1 lebih nyaman untuk Pandas dan pembuatan PDF; gunakan minimal 1 OCPU dan 6 GB RAM jika kapasitas tersedia.
5. Buat VCN baru, public subnet, dan aktifkan **Assign a public IPv4 address**.
6. Buat atau unggah SSH key. Simpan private key karena diperlukan untuk masuk ke server.
7. Setelah VM aktif, catat **Public IP address**.

Pada VCN Security List, tambahkan ingress TCP:

- Port `22` dari IP administrator bila memungkinkan.
- Port `80` dari `0.0.0.0/0` untuk HTTP.
- Port `443` dari `0.0.0.0/0` untuk HTTPS.

Jangan membuka port MariaDB `3306` ke internet.

## 2. Hubungkan Windows ke VM

Jalankan dari PowerShell. Ganti path key dan IP:

```powershell
ssh -i "C:\Users\hanaf\Downloads\ssh-key.key" ubuntu@PUBLIC_IP
```

## 3. Instal paket server

Jalankan di terminal Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3-venv python3-pip mariadb-server nginx git apache2-utils unzip
sudo systemctl enable --now mariadb nginx
```

## 4. Ambil source code

Jika repository GitHub bersifat private, gunakan deploy key atau Personal Access Token. Contoh repository public:

```bash
sudo git clone https://github.com/hanafiilham/monitor-case.git /opt/sga-dashboard
sudo chown -R ubuntu:www-data /opt/sga-dashboard
cd /opt/sga-dashboard
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements-prod.txt
```

## 5. Siapkan MariaDB

Buat password database yang kuat dan berbeda dari contoh berikut:

```bash
sudo mariadb
```

Di prompt MariaDB:

```sql
CREATE DATABASE IF NOT EXISTS sga_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'sga_user'@'127.0.0.1' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON sga_dashboard.* TO 'sga_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

Buat konfigurasi aplikasi:

```bash
cd /opt/sga-dashboard
cp .env.example .env
nano .env
```

Isi production:

```env
APP_NAME=SGA Dashboard
APP_ENV=production
APP_HOST=127.0.0.1
APP_PORT=8501
APP_DEBUG=false
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=sga_dashboard
DB_USER=sga_user
DB_PASSWORD=GANTI_PASSWORD_KUAT
```

Lindungi file dan folder data:

```bash
chmod 600 /opt/sga-dashboard/.env
mkdir -p /opt/sga-dashboard/data/{uploads,transformed,exports,archives,sample}
mkdir -p /opt/sga-dashboard/logs
sudo chown -R ubuntu:www-data /opt/sga-dashboard
chmod -R 775 /opt/sga-dashboard/data /opt/sga-dashboard/logs
```

## 6. Migrasikan database lama

Di laptop Windows yang masih memiliki database lama:

```powershell
mysqldump -u root -p --single-transaction --routines --triggers sga_dashboard > sga_dashboard.sql
scp -i "C:\Users\hanaf\Downloads\ssh-key.key" .\sga_dashboard.sql ubuntu@PUBLIC_IP:/tmp/sga_dashboard.sql
```

Di VM:

```bash
sudo mariadb sga_dashboard < /tmp/sga_dashboard.sql
rm /tmp/sga_dashboard.sql
```

Folder arsip/upload tidak tersimpan di database. Kirim juga folder `data` dari laptop:

```powershell
Compress-Archive -Path .\data\archives,.\data\uploads,.\data\transformed -DestinationPath .\imc-data.zip -Force
scp -i "C:\Users\hanaf\Downloads\ssh-key.key" .\imc-data.zip ubuntu@PUBLIC_IP:/tmp/imc-data.zip
```

Kemudian di VM:

```bash
cd /opt/sga-dashboard
unzip -o /tmp/imc-data.zip
rm /tmp/imc-data.zip
sudo chown -R ubuntu:www-data /opt/sga-dashboard/data
chmod -R 775 /opt/sga-dashboard/data
```

## 7. Aktifkan Gunicorn dan Nginx

Karena login aplikasi sudah dihapus, buat pengaman pada Nginx. Ganti `admin-imc` dengan username yang diinginkan:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd admin-imc
sudo chmod 640 /etc/nginx/.htpasswd
sudo chown root:www-data /etc/nginx/.htpasswd
```

Pasang konfigurasi:

```bash
sudo cp /opt/sga-dashboard/deploy/oracle/imc.service /etc/systemd/system/imc.service
sudo cp /opt/sga-dashboard/deploy/oracle/nginx.conf /etc/nginx/sites-available/imc
sudo ln -sfn /etc/nginx/sites-available/imc /etc/nginx/sites-enabled/imc
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now imc
sudo systemctl restart nginx
```

Periksa layanan:

```bash
sudo systemctl status imc --no-pager
sudo journalctl -u imc -n 100 --no-pager
curl -I http://127.0.0.1:8501
```

Buka `http://PUBLIC_IP` dari browser. Browser akan meminta username dan password Nginx.

## 8. Aktifkan firewall Ubuntu

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 9. Domain dan HTTPS

Untuk penggunaan nyata, arahkan domain/subdomain ke public IP VM lalu pasang Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d imc.domain-anda.com
```

Setelah HTTPS berhasil, gunakan URL `https://imc.domain-anda.com`. Jangan gunakan Basic Auth melalui HTTP untuk data nyata.

## 10. Backup harian

Pasang script backup dan jadwalkan pukul 02:00:

```bash
sudo cp /opt/sga-dashboard/deploy/oracle/backup.sh /usr/local/sbin/imc-backup
sudo chmod 750 /usr/local/sbin/imc-backup
sudo crontab -e
```

Tambahkan:

```cron
0 2 * * * /usr/local/sbin/imc-backup
```

Backup lokal server bukan satu-satunya salinan. Unduh backup berkala ke perangkat lain atau Object Storage.

## Update aplikasi berikutnya

```bash
cd /opt/sga-dashboard
git pull
.venv/bin/pip install -r requirements-prod.txt
sudo systemctl restart imc
sudo journalctl -u imc -n 50 --no-pager
```

Jangan commit `.env`, private SSH key, dump database, atau dokumen karyawan ke GitHub.
