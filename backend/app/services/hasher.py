from __future__ import annotations

import hashlib
from datetime import date


def compute_transaction_hash(
    txn_date: date,
    amount_cents: int,
    raw_description: str,
    account_id: int,
) -> str:
    """SHA-256 hash for transaction deduplication.

    Uses raw_description (not cleaned) to ensure exact-match semantics.
    Uses account_id to allow the same transaction description+amount on
    the same date in different accounts.
    """
    payload = f"{txn_date.isoformat()}|{amount_cents}|{raw_description}|{account_id}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compute_file_hash(content: bytes) -> str:
    """SHA-256 hash of file content for whole-file deduplication."""
    return hashlib.sha256(content).hexdigest()
