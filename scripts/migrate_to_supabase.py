"""Copy local MySQL tables to an empty PostgreSQL database, preserving IDs."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sqlalchemy import MetaData, create_engine, func, select, text
from sqlalchemy.engine import URL
from config.settings import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER
from models.database_models import Base
from services.database import create_tables, get_engine


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Copy rows; default only shows local row counts")
    args = parser.parse_args()
    source = create_engine(URL.create("mysql+pymysql", username=DB_USER, password=DB_PASSWORD,
                                     host=DB_HOST, port=DB_PORT, database=DB_NAME))
    target = get_engine()
    if target.dialect.name != "postgresql":
        raise ValueError("DATABASE_URL must point to PostgreSQL.")
    source_meta = MetaData()
    source_meta.reflect(bind=source)
    tables = [table for table in Base.metadata.sorted_tables if table.name in source_meta.tables]
    with source.connect() as connection:
        for table in tables:
            count = connection.scalar(select(func.count()).select_from(source_meta.tables[table.name]))
            print(table.name, count)
    if not args.apply:
        print("Dry run only. Use --apply to migrate into an empty destination.")
        return
    create_tables()
    with source.connect() as src, target.begin() as dst:
        dst.execute(text("SELECT pg_advisory_xact_lock(2918501)"))
        for table in Base.metadata.sorted_tables:
            if dst.scalar(select(func.count()).select_from(table)):
                raise ValueError("Destination is not empty; migration stopped without overwriting rows.")
        for table in tables:
            source_table = source_meta.tables[table.name]
            columns = set(table.columns.keys())
            result = src.execute(select(source_table))
            while rows := result.mappings().fetchmany(500):
                dst.execute(table.insert(), [{key: value for key, value in row.items() if key in columns} for row in rows])
            dst.execute(text("SELECT setval(pg_get_serial_sequence(:table, 'id'), "
                             f'COALESCE((SELECT MAX(id) FROM "{table.name}"), 1), '
                             f'EXISTS(SELECT 1 FROM "{table.name}"))'), {"table": table.name})
    source.dispose()
    print("Migration completed. Source database was not modified.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Migration failed:", type(exc).__name__)
        print("Check local DB settings and DATABASE_URL. Destination must be empty.")
        sys.exit(1)
