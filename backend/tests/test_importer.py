from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.csv_import import CsvImport
from app.models.household_member import HouseholdMember
from app.models.transaction import Transaction
from app.services.importer import ImportService


def _make_credit_csv(rows: list[str]) -> bytes:
    header = "Date,Description,Original Description,Category,Amount,Status\n"
    return (header + "\n".join(rows)).encode("utf-8")


class TestImporter:
    def test_basic_import(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        csv_content = _make_credit_csv(
            [
                '2026-05-01,"Publix","PUBLIX #557 LAKE WALES FL",Groceries,70.31,Posted',
                '2026-05-02,"Shell","SHELL OIL 12345",Gas,45.00,Posted',
            ]
        )

        service = ImportService(db_session)
        result = service.import_csv(csv_content, "test.csv", sample_account.id)

        assert result.total_rows == 2
        assert result.new_transactions == 2
        assert result.duplicate_transactions == 0
        assert result.categorized_count == 2  # Both matched by rules
        assert result.uncategorized_count == 0
        assert "DUPLICATE_FILE" not in result.errors

        # Verify transactions in DB
        txns = db_session.query(Transaction).all()
        assert len(txns) == 2

    def test_duplicate_file_detection(
        self,
        db_session: Session,
        sample_account: Account,
    ):
        csv_content = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST STORE",Other,10.00,Posted',
            ]
        )

        service = ImportService(db_session)
        result1 = service.import_csv(csv_content, "test.csv", sample_account.id)
        assert result1.new_transactions == 1

        # Import same file again
        result2 = service.import_csv(csv_content, "test.csv", sample_account.id)
        assert "DUPLICATE_FILE" in result2.errors

    def test_transaction_dedup(
        self,
        db_session: Session,
        sample_account: Account,
    ):
        """Same transaction in different files should be deduped by hash."""
        csv1 = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST STORE",Other,10.00,Posted',
                '2026-05-02,"Test2","TEST STORE 2",Other,20.00,Posted',
            ]
        )
        csv2 = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST STORE",Other,10.00,Posted',  # Duplicate
                '2026-05-03,"Test3","TEST STORE 3",Other,30.00,Posted',  # New
            ]
        )

        service = ImportService(db_session)
        result1 = service.import_csv(csv1, "file1.csv", sample_account.id)
        assert result1.new_transactions == 2

        result2 = service.import_csv(csv2, "file2.csv", sample_account.id)
        assert result2.new_transactions == 1
        assert result2.duplicate_transactions == 1

        # Total unique transactions in DB
        total = db_session.query(Transaction).count()
        assert total == 3

    def test_person_assignment_joint(
        self,
        db_session: Session,
        sample_account: Account,  # Joint account
    ):
        """Joint account should leave household_member_id as NULL."""
        csv = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST STORE",Other,10.00,Posted',
            ]
        )

        service = ImportService(db_session)
        service.import_csv(csv, "test.csv", sample_account.id)

        txn = db_session.query(Transaction).first()
        assert txn.household_member_id is None

    def test_person_assignment_personal(
        self,
        db_session: Session,
        sample_member: HouseholdMember,
    ):
        """Personal account should assign the account owner."""
        personal_account = Account(
            name="Personal Checking",
            institution="USAA",
            account_type="checking",
            owner_type="personal",
            household_member_id=sample_member.id,
        )
        db_session.add(personal_account)
        db_session.commit()

        csv_content = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST STORE",Other,-10.00,Posted',
            ]
        )

        service = ImportService(db_session)
        service.import_csv(csv_content, "test.csv", personal_account.id)

        txn = db_session.query(Transaction).first()
        assert txn.household_member_id == sample_member.id

    def test_internal_transfer_detection(
        self,
        db_session: Session,
        sample_account: Account,
    ):
        csv = _make_credit_csv(
            [
                '2026-05-01,"Payment","USAA CREDIT CARD PAYMENT",Transfers,500.00,Posted',
                '2026-05-02,"Store","REGULAR STORE",Other,25.00,Posted',
            ]
        )

        service = ImportService(db_session)
        service.import_csv(csv, "test.csv", sample_account.id)

        txns = db_session.query(Transaction).order_by(Transaction.date).all()
        assert txns[0].is_internal_transfer is True
        assert txns[1].is_internal_transfer is False

    def test_csv_import_record_created(
        self,
        db_session: Session,
        sample_account: Account,
    ):
        csv = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST",Other,10.00,Posted',
            ]
        )

        service = ImportService(db_session)
        result = service.import_csv(csv, "my_file.csv", sample_account.id)

        imp = db_session.query(CsvImport).filter(CsvImport.id == result.csv_import_id).first()
        assert imp is not None
        assert imp.filename == "my_file.csv"
        assert imp.row_count == 1
        assert imp.new_transaction_count == 1
        assert imp.account_id == sample_account.id

    def test_empty_csv(
        self,
        db_session: Session,
        sample_account: Account,
    ):
        csv = b"Date,Description,Original Description,Category,Amount,Status\n"

        service = ImportService(db_session)
        result = service.import_csv(csv, "empty.csv", sample_account.id)

        assert result.total_rows == 0
        assert result.new_transactions == 0

    def test_invalid_account_raises(self, db_session: Session):
        csv = _make_credit_csv(
            [
                '2026-05-01,"Test","TEST",Other,10.00,Posted',
            ]
        )
        service = ImportService(db_session)
        try:
            service.import_csv(csv, "test.csv", 99999)
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "not found" in str(e)

    def test_usaa_category_preserved(
        self,
        db_session: Session,
        sample_account: Account,
    ):
        csv = _make_credit_csv(
            [
                '2026-05-01,"Publix","PUBLIX",Groceries,70.00,Posted',
            ]
        )

        service = ImportService(db_session)
        service.import_csv(csv, "test.csv", sample_account.id)

        txn = db_session.query(Transaction).first()
        assert txn.usaa_category == "Groceries"
