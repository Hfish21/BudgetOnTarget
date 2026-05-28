"""
Round-trip validation: SQLite → .budget JSON → temp SQLite → .budget JSON.
Compares the two JSON outputs to verify the format is lossless.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (  # noqa: F401 — register all models on Base.metadata
    Account,
    Category,
    CategoryRule,
    CsvImport,
    HouseholdMember,
    Tag,
    Target,
    Transaction,
    transaction_tags,
)
from app.routes.budget_file import _export_budget, _import_budget


def make_session(db_url: str):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_conn, _):
        c = dbapi_conn.cursor()
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        c.close()

    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def normalize_for_comparison(data: dict) -> dict:
    d = dict(data)
    d.pop("exported_at", None)
    return d


def main():
    primary_db = os.environ.get("BOT_DATABASE_URL", "sqlite:///./budgetontarget.db")
    print(f"[1/4] Exporting from primary database: {primary_db}")
    session1 = make_session(primary_db)
    export1 = _export_budget(session1)
    json1 = json.loads(export1.model_dump_json())
    session1.close()

    print(f"       → {len(json1['transactions'])} transactions, "
          f"{len(json1['categories'])} categories, "
          f"{len(json1['category_rules'])} rules, "
          f"{len(json1['targets'])} targets, "
          f"{len(json1['accounts'])} accounts, "
          f"{len(json1['household_members'])} members, "
          f"{len(json1['csv_imports'])} imports, "
          f"{len(json1['tags'])} tags")

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name
    tmp_url = f"sqlite:///{tmp_path}"

    try:
        print(f"[2/4] Importing into temp database: {tmp_path}")
        session2 = make_session(tmp_url)
        counts = _import_budget(session2, export1)
        print(f"       → Imported: {counts}")
        session2.close()

        print("[3/4] Re-exporting from temp database...")
        session3 = make_session(tmp_url)
        export2 = _export_budget(session3)
        json2 = json.loads(export2.model_dump_json())
        session3.close()

        norm1 = normalize_for_comparison(json1)
        norm2 = normalize_for_comparison(json2)

        print("[4/4] Comparing exports...")
        if norm1 == norm2:
            print("\n✓ PASS: Round-trip is lossless. Both exports are identical.")
        else:
            for key in sorted(set(list(norm1.keys()) + list(norm2.keys()))):
                v1 = norm1.get(key)
                v2 = norm2.get(key)
                if v1 == v2:
                    print(f"  ✓ {key}: match")
                else:
                    if isinstance(v1, list) and isinstance(v2, list):
                        print(f"  ✗ {key}: {len(v1)} vs {len(v2)} items")
                        for i, (a, b) in enumerate(zip(v1, v2)):
                            if a != b:
                                print(f"    First diff at index {i}:")
                                for field in sorted(set(list(a.keys()) + list(b.keys()))):
                                    if a.get(field) != b.get(field):
                                        print(f"      {field}: {a.get(field)!r} → {b.get(field)!r}")
                                break
                    else:
                        print(f"  ✗ {key}: {v1!r} != {v2!r}")
            print("\n✗ FAIL: Round-trip produced different output.")
            sys.exit(1)

        out_path = "export_snapshot.budget"
        with open(out_path, "w") as f:
            json.dump(json1, f, indent=2, default=str)
        size_mb = os.path.getsize(out_path) / (1024 * 1024)
        print(f"\nSnapshot saved to {out_path} ({size_mb:.2f} MB)")

    finally:
        os.unlink(tmp_path)
        for suffix in ("-shm", "-wal"):
            try:
                os.unlink(tmp_path + suffix)
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    main()
