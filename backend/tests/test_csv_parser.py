from __future__ import annotations

from datetime import date

import pytest

from app.services.csv_parser import UsaaCsvParser, _clean_description


class TestCleanDescription:
    def test_strips_whitespace(self):
        assert _clean_description("  PUBLIX  ") == "PUBLIX"

    def test_collapses_multiple_spaces(self):
        assert _clean_description("PUBLIX   #557    LAKE WALES") == "PUBLIX #557 LAKE WALES"

    def test_uppercases(self):
        assert _clean_description("Publix Super Market") == "PUBLIX SUPER MARKET"

    def test_combined(self):
        assert _clean_description("  publix   #557  ") == "PUBLIX #557"


class TestUsaaCsvParserCredit:
    """Tests for credit card CSV parsing."""

    def _make_csv(self, rows: list[str]) -> bytes:
        header = "Date,Description,Original Description,Category,Amount,Status\n"
        return (header + "\n".join(rows)).encode("utf-8")

    def test_basic_credit_charge(self):
        row = (
            '2026-05-22,"Publix","PUBLIX #557              LAKE WALES   FL",Groceries,70.31,Posted'
        )
        csv = self._make_csv([row])
        parser = UsaaCsvParser(account_type="credit")
        result = parser.parse(csv, "test.csv")

        assert len(result) == 1
        txn = result[0]
        assert txn.date == date(2026, 5, 22)
        assert txn.raw_description == "PUBLIX #557              LAKE WALES   FL"
        assert txn.description == "PUBLIX #557 LAKE WALES FL"
        # Credit card: positive in CSV = charge = money out = negative after normalization
        assert txn.amount_cents == -7031
        assert txn.usaa_category == "Groceries"
        assert txn.status == "Posted"

    def test_credit_payment_is_positive(self):
        csv = self._make_csv(
            ['2026-05-22,"Payment","USAA CREDIT CARD PAYMENT",Transfers,-500.00,Posted']
        )
        parser = UsaaCsvParser(account_type="credit")
        result = parser.parse(csv, "test.csv")

        assert len(result) == 1
        # Credit card: negative in CSV = payment = money in = positive after normalization
        assert result[0].amount_cents == 50000

    def test_skips_pending(self):
        csv = self._make_csv(
            [
                '2026-05-22,"Publix","PUBLIX #557",Groceries,70.31,Posted',
                '2026-05-24,"GOOGLE","GOOGLE *Google One",Category Pending,2.99,Pending',
            ]
        )
        parser = UsaaCsvParser(account_type="credit")
        result = parser.parse(csv, "test.csv")

        assert len(result) == 1
        assert result[0].description == "PUBLIX #557"

    def test_category_pending_becomes_none(self):
        csv = self._make_csv(
            [
                '2026-05-24,"GOOGLE","GOOGLE *Google One",Category Pending,2.99,Posted',
            ]
        )
        parser = UsaaCsvParser(account_type="credit")
        result = parser.parse(csv, "test.csv")

        assert result[0].usaa_category is None

    def test_empty_csv(self):
        csv = b"Date,Description,Original Description,Category,Amount,Status\n"
        parser = UsaaCsvParser(account_type="credit")
        result = parser.parse(csv, "test.csv")
        assert result == []

    def test_handles_bom(self):
        csv = b"\xef\xbb\xbfDate,Description,Original Description,Category,Amount,Status\n"
        csv += b'2026-05-22,"Publix","PUBLIX",Groceries,10.00,Posted\n'
        parser = UsaaCsvParser(account_type="credit")
        result = parser.parse(csv, "test.csv")
        assert len(result) == 1


class TestUsaaCsvParserChecking:
    """Tests for checking account CSV parsing."""

    def _make_csv(self, rows: list[str]) -> bytes:
        header = "Date,Description,Original Description,Category,Amount,Status\n"
        return (header + "\n".join(rows)).encode("utf-8")

    def test_checking_spending_stays_negative(self):
        csv = self._make_csv(['2026-05-22,"Publix","PUBLIX #557",Groceries,-70.31,Posted'])
        parser = UsaaCsvParser(account_type="checking")
        result = parser.parse(csv, "test.csv")

        assert len(result) == 1
        # Checking: negative stays negative (already correct convention)
        assert result[0].amount_cents == -7031

    def test_checking_income_stays_positive(self):
        csv = self._make_csv(['2026-05-01,"Payroll","DIRECT DEP PAYROLL",Income,3500.00,Posted'])
        parser = UsaaCsvParser(account_type="checking")
        result = parser.parse(csv, "test.csv")

        assert result[0].amount_cents == 350000

    def test_cents_precision(self):
        csv = self._make_csv(['2026-05-22,"Test","TEST STORE",Shopping,-0.01,Posted'])
        parser = UsaaCsvParser(account_type="checking")
        result = parser.parse(csv, "test.csv")
        assert result[0].amount_cents == -1


class TestUsaaCsvParserValidation:
    def test_invalid_account_type_raises(self):
        with pytest.raises(ValueError, match="Unsupported account type"):
            UsaaCsvParser(account_type="invalid")
