#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/var/backups/imc"
APP_ROOT="/opt/sga-dashboard"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="${BACKUP_ROOT}/${STAMP}"

install -d -m 700 "${TARGET}"
mariadb-dump --single-transaction --routines --triggers sga_dashboard | gzip > "${TARGET}/sga_dashboard.sql.gz"
tar -czf "${TARGET}/application-files.tar.gz" \
    -C "${APP_ROOT}" data/archives data/uploads data/transformed

find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
