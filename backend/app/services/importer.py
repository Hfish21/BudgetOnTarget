from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.csv_import import CsvImport
from app.models.transaction import Transaction
from app.services.categorizer import Categorizer
from app.services.csv_parser import UsaaCsvParser
from app.services.hasher import compute_file_hash, compute_transaction_hash

# Patterns that indicate internal transfers between accounts
INTERNAL_TRANSFER_PATTERNS = [
    re.compile(r"USAA CREDIT CARD PAYMENT", re.IGNORECASE),
    re.compile(r"USAA FUNDS TRANSFER", re.IGNORECASE),
    re.compile(r"USAA TRANSFER", re.IGNORECASE),
    re.compile(r"ZELLE.*(?:HAYDEN|JORDYN)", re.IGNORECASE),
    re.compile(r"(?:HAYDEN|JORDYN).*ZELLE", re.IGNORECASE),
]


def _is_internal_transfer(description: str) -> bool:
    """Check if a transaction description matches internal transfer patterns."""
    for pattern in INTERNAL_TRANSFER_PATTERNS:
        if pattern.search(description):
            return True
    return False


@dataclass
class ImportResult:
    csv_import_id: int
    filename: str
    total_rows: int
    new_transactions: int
    duplicate_transactions: int
    categorized_count: int
    uncategorized_count: int
    errors: list[str] = field(default_factory=list)


class ImportService:
    """Orchestrates the full CSV import pipeline."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def import_csv(
        self,
        file_content: bytes,
        filename: str,
        account_id: int,
    ) -> ImportResult:
        """Full import flow:

        1. Compute file hash. If csv_imports already has this hash, raise for 409.
        2. Look up account to determine parser and owner info.
        3. Parse CSV via UsaaCsvParser.
        4. For each parsed transaction: compute external_hash, skip if exists,
           run categorizer, detect internal transfers.
        5. Person assignment: if account is "personal", assign the account's
           household_member_id. If "joint", leave NULL.
        6. Bulk insert, create csv_imports record, return ImportResult.
        """
        # Step 1: Check for duplicate file
        file_hash = compute_file_hash(file_content)
        existing_import = self.db.query(CsvImport).filter(CsvImport.file_hash == file_hash).first()
        if existing_import:
            return ImportResult(
                csv_import_id=existing_import.id,
                filename=filename,
                total_rows=0,
                new_transactions=0,
                duplicate_transactions=0,
                categorized_count=0,
                uncategorized_count=0,
                errors=["DUPLICATE_FILE"],
            )

        # Step 2: Look up account
        account = self.db.query(Account).filter(Account.id == account_id).first()
        if account is None:
            msg = f"Account with id {account_id} not found"
            raise ValueError(msg)

        # Step 3: Parse CSV
        parser = UsaaCsvParser(account_type=account.account_type)
        parsed_transactions = parser.parse(file_content, filename)

        if not parsed_transactions:
            # Create import record even for empty files
            csv_import = CsvImport(
                filename=filename,
                file_hash=file_hash,
                row_count=0,
                new_transaction_count=0,
                account_id=account_id,
            )
            self.db.add(csv_import)
            self.db.commit()
            self.db.refresh(csv_import)
            return ImportResult(
                csv_import_id=csv_import.id,
                filename=filename,
                total_rows=0,
                new_transactions=0,
                duplicate_transactions=0,
                categorized_count=0,
                uncategorized_count=0,
            )

        # Step 4: Compute hashes and check for existing transactions
        categorizer = Categorizer(self.db)

        # Compute all hashes for batch lookup
        hash_map: dict[str, int] = {}
        for i, pt in enumerate(parsed_transactions):
            h = compute_transaction_hash(pt.date, pt.amount_cents, pt.raw_description, account_id)
            hash_map[h] = i

        existing_hashes = set(
            row[0]
            for row in self.db.query(Transaction.external_hash)
            .filter(Transaction.external_hash.in_(list(hash_map.keys())))
            .all()
        )

        # Step 5: Create import record first (for FK reference)
        csv_import = CsvImport(
            filename=filename,
            file_hash=file_hash,
            row_count=len(parsed_transactions),
            new_transaction_count=0,  # Updated after insert
            account_id=account_id,
        )
        self.db.add(csv_import)
        self.db.flush()  # Get the ID without committing

        # Step 6: Build transaction objects
        new_transactions: list[Transaction] = []
        categorized_count = 0
        duplicate_count = 0

        # Determine person assignment
        member_id = None
        if account.owner_type == "personal" and account.household_member_id is not None:
            member_id = account.household_member_id

        for ext_hash, idx in hash_map.items():
            if ext_hash in existing_hashes:
                duplicate_count += 1
                continue

            pt = parsed_transactions[idx]
            category_id = categorizer.categorize(pt.description)
            is_transfer = _is_internal_transfer(pt.description)

            if category_id is not None:
                categorized_count += 1

            txn = Transaction(
                external_hash=ext_hash,
                date=pt.date,
                description=pt.description,
                raw_description=pt.raw_description,
                amount_cents=pt.amount_cents,
                account_id=account_id,
                household_member_id=member_id,
                category_id=category_id,
                usaa_category=pt.usaa_category,
                is_internal_transfer=is_transfer,
                is_manually_categorized=False,
                csv_import_id=csv_import.id,
            )
            new_transactions.append(txn)

        # Step 7: Bulk insert
        self.db.add_all(new_transactions)
        csv_import.new_transaction_count = len(new_transactions)
        self.db.commit()
        self.db.refresh(csv_import)

        new_count = len(new_transactions)
        uncategorized_count = new_count - categorized_count

        return ImportResult(
            csv_import_id=csv_import.id,
            filename=filename,
            total_rows=len(parsed_transactions),
            new_transactions=new_count,
            duplicate_transactions=duplicate_count,
            categorized_count=categorized_count,
            uncategorized_count=uncategorized_count,
        )
