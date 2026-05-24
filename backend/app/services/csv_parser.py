from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime


@dataclass
class ParsedTransaction:
    date: date
    raw_description: str
    description: str  # Cleaned: stripped, extra whitespace collapsed, uppercased
    amount_cents: int  # Normalized: negative = out, positive = in
    usaa_category: str | None
    status: str  # "Posted" or "Pending"


def _clean_description(raw: str) -> str:
    """Strip whitespace, collapse multiple spaces, uppercase."""
    cleaned = raw.strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.upper()


def _dollars_to_cents(amount_str: str) -> int:
    """Convert dollar string to integer cents, handling float precision."""
    return int(round(float(amount_str) * 100))


class UsaaCsvParser:
    """Parser for USAA bank CSV exports.

    USAA CSV format:
        Date,Description,Original Description,Category,Amount,Status

    Sign convention differs by account type:
    - Credit card: charges are POSITIVE, payments/credits are NEGATIVE
    - Checking/Savings: spending is NEGATIVE, income is POSITIVE

    The parser normalizes so ALL accounts use: negative = money out, positive = money in.
    """

    def __init__(self, account_type: str) -> None:
        if account_type not in ("checking", "credit", "savings"):
            msg = f"Unsupported account type: {account_type}"
            raise ValueError(msg)
        self.account_type = account_type

    def parse(self, file_content: bytes, filename: str) -> list[ParsedTransaction]:
        """Parse a USAA CSV file into normalized ParsedTransaction objects.

        Skips rows with Status='Pending'.
        For credit cards, flips the sign (USAA has charges as positive).
        For checking/savings, keeps as-is.
        """
        text = file_content.decode("utf-8-sig")  # Handle BOM if present
        reader = csv.DictReader(io.StringIO(text))

        transactions: list[ParsedTransaction] = []

        for row in reader:
            status = row.get("Status", "").strip()
            if status == "Pending":
                continue

            date_str = row["Date"].strip()
            txn_date = datetime.strptime(date_str, "%Y-%m-%d").date()

            raw_description = row.get("Original Description", "").strip()
            if not raw_description:
                raw_description = row.get("Description", "").strip()

            description = _clean_description(raw_description)

            amount_cents = _dollars_to_cents(row["Amount"].strip())

            # Normalize sign convention
            if self.account_type == "credit":
                # USAA credit: positive = charge (money out), negative = payment (money in)
                # We want: negative = money out, positive = money in
                amount_cents = -amount_cents

            usaa_category = row.get("Category", "").strip() or None
            if usaa_category == "Category Pending":
                usaa_category = None

            transactions.append(
                ParsedTransaction(
                    date=txn_date,
                    raw_description=raw_description,
                    description=description,
                    amount_cents=amount_cents,
                    usaa_category=usaa_category,
                    status=status,
                )
            )

        return transactions
