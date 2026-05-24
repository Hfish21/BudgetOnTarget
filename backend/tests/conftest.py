from __future__ import annotations

from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.account import Account
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.household_member import HouseholdMember

TEST_DATABASE_URL = "sqlite:///./test_ledgerline.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def db_session() -> Generator[Session, None, None]:
    """Create a clean database for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestSessionLocal()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_member(db_session: Session) -> HouseholdMember:
    member = HouseholdMember(name="Hayden")
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


@pytest.fixture
def sample_account(db_session: Session) -> Account:
    account = Account(
        name="USAA Credit Card",
        institution="USAA",
        account_type="credit",
        owner_type="joint",
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def checking_account(db_session: Session) -> Account:
    account = Account(
        name="USAA Joint Checking",
        institution="USAA",
        account_type="checking",
        owner_type="joint",
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def sample_categories(db_session: Session) -> dict[str, Category]:
    names = ["Groceries", "Gas", "Dining Out", "Shopping", "Income", "Transfers", "Fast Food"]
    categories = {}
    for name in names:
        cat = Category(name=name)
        db_session.add(cat)
        db_session.flush()
        categories[name] = cat
    db_session.commit()
    return categories


@pytest.fixture
def sample_rules(
    db_session: Session,
    sample_categories: dict[str, Category],
) -> list[CategoryRule]:
    rules_data = [
        ("PUBLIX", "substring", "Groceries", 10),
        ("SHELL", "substring", "Gas", 20),
        ("AMAZON|AMZN", "regex", "Shopping", 30),
    ]
    rules = []
    for pattern, match_type, cat_name, priority in rules_data:
        rule = CategoryRule(
            pattern=pattern,
            match_type=match_type,
            category_id=sample_categories[cat_name].id,
            priority=priority,
            is_active=True,
        )
        db_session.add(rule)
        rules.append(rule)
    db_session.commit()
    return rules
