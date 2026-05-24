"""Seed script for LedgerLine.

Creates default household members, accounts, categories, category rules,
and a starter target. Idempotent: skips items that already exist.

Usage:
    cd backend
    uv run python -m app.seed.run
"""

from __future__ import annotations

from app.database import SessionLocal
from app.models.account import Account
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.household_member import HouseholdMember
from app.models.target import Target

# --------------------------------------------------------------------------
# Data definitions
# --------------------------------------------------------------------------

HOUSEHOLD_MEMBERS = ["Hayden", "Jordyn"]

ACCOUNTS = [
    {
        "name": "USAA Credit Card",
        "institution": "USAA",
        "account_type": "credit",
        "owner_type": "joint",
        "household_member_name": None,
    },
    {
        "name": "USAA Joint Checking",
        "institution": "USAA",
        "account_type": "checking",
        "owner_type": "joint",
        "household_member_name": None,
    },
    {
        "name": "USAA Personal Checking",
        "institution": "USAA",
        "account_type": "checking",
        "owner_type": "personal",
        "household_member_name": "Hayden",
    },
]

CATEGORIES = [
    "Income",
    "Groceries",
    "Dining Out",
    "Fast Food",
    "Gas",
    "Utilities",
    "Rent/Mortgage",
    "Insurance",
    "Healthcare",
    "Entertainment",
    "Shopping",
    "Subscriptions",
    "Transportation",
    "Home Improvement",
    "Personal Care",
    "Gifts",
    "Education",
    "Travel",
    "Pet",
    "Clothing",
    "Coffee",
    "Internet",
    "Transfers",
    "Fees & Charges",
    "Other",
]

# (pattern, match_type, category_name, priority)
CATEGORY_RULES: list[tuple[str, str, str, int]] = [
    ("PUBLIX", "substring", "Groceries", 10),
    ("WALMART", "substring", "Groceries", 15),
    ("ALDI", "substring", "Groceries", 20),
    ("KROGER", "substring", "Groceries", 30),
    ("DUNKIN", "substring", "Coffee", 40),
    ("STARBUCKS", "substring", "Coffee", 50),
    ("COOK OUT", "substring", "Fast Food", 60),
    ("MCDONALD", "substring", "Fast Food", 70),
    ("CHICK-FIL-A", "substring", "Fast Food", 80),
    ("WENDY", "substring", "Fast Food", 90),
    ("TACO BELL", "substring", "Fast Food", 100),
    ("SHELL", "substring", "Gas", 110),
    ("EXXON", "substring", "Gas", 120),
    ("CHEVRON", "substring", "Gas", 130),
    ("BP ", "substring", "Gas", 140),
    ("MARATHON", "substring", "Gas", 150),
    ("RACETRAC", "substring", "Gas", 160),
    ("WAWA", "substring", "Gas", 170),
    ("AMAZON|AMZN", "regex", "Shopping", 180),
    ("HOME DEPOT", "substring", "Home Improvement", 190),
    ("LOWE", "substring", "Home Improvement", 200),
    ("RURAL KING", "substring", "Home Improvement", 210),
    ("NETFLIX", "substring", "Subscriptions", 220),
    ("SPOTIFY", "substring", "Subscriptions", 230),
    ("DISNEY", "substring", "Subscriptions", 240),
    ("HULU", "substring", "Subscriptions", 250),
    ("GOOGLE", "substring", "Subscriptions", 260),
    ("APPLE.COM", "substring", "Subscriptions", 270),
    ("STARLINK", "substring", "Internet", 280),
    ("USAA INSURANCE", "substring", "Insurance", 290),
    ("MORTGAGE|SHELLPOINT|NEWREZ", "regex", "Rent/Mortgage", 300),
    ("PAYROLL|DIRECT DEP", "regex", "Income", 310),
    (
        "USAA CREDIT CARD PAYMENT|USAA FUNDS TRANSFER|USAA TRANSFER",
        "regex",
        "Transfers",
        320,
    ),
]

STARTER_TARGET = {
    "name": "Grocery Budget",
    "target_type": "monetary",
    "direction": "at_most",
    "value": 60000,  # $600
    "tolerance_upper": 5000,  # $50
    "tolerance_lower": 5000,  # $50
    "period": "monthly",
    "person_scope": None,
    "category_name": "Groceries",
    "description_pattern": None,
}


# --------------------------------------------------------------------------
# Seed execution
# --------------------------------------------------------------------------


def seed() -> None:
    db = SessionLocal()
    try:
        _seed_members(db)
        _seed_accounts(db)
        _seed_categories(db)
        _seed_rules(db)
        _seed_targets(db)
        print("Seed complete.")
    finally:
        db.close()


def _seed_members(db) -> None:
    for name in HOUSEHOLD_MEMBERS:
        existing = db.query(HouseholdMember).filter(HouseholdMember.name == name).first()
        if not existing:
            db.add(HouseholdMember(name=name))
            print(f"  Created household member: {name}")
        else:
            print(f"  Skipped household member (exists): {name}")
    db.commit()


def _seed_accounts(db) -> None:
    for acct in ACCOUNTS:
        existing = db.query(Account).filter(Account.name == acct["name"]).first()
        if existing:
            print(f"  Skipped account (exists): {acct['name']}")
            continue

        member_id = None
        if acct["household_member_name"]:
            member = (
                db.query(HouseholdMember)
                .filter(HouseholdMember.name == acct["household_member_name"])
                .first()
            )
            if member:
                member_id = member.id

        db.add(
            Account(
                name=acct["name"],
                institution=acct["institution"],
                account_type=acct["account_type"],
                owner_type=acct["owner_type"],
                household_member_id=member_id,
            )
        )
        print(f"  Created account: {acct['name']}")
    db.commit()


def _seed_categories(db) -> None:
    for name in CATEGORIES:
        existing = db.query(Category).filter(Category.name == name).first()
        if not existing:
            db.add(Category(name=name))
            print(f"  Created category: {name}")
        else:
            print(f"  Skipped category (exists): {name}")
    db.commit()


def _seed_rules(db) -> None:
    for pattern, match_type, category_name, priority in CATEGORY_RULES:
        # Check if rule with this pattern already exists
        existing = db.query(CategoryRule).filter(CategoryRule.pattern == pattern).first()
        if existing:
            print(f"  Skipped rule (exists): {pattern}")
            continue

        category = db.query(Category).filter(Category.name == category_name).first()
        if not category:
            print(f"  WARNING: Category '{category_name}' not found for rule '{pattern}'")
            continue

        db.add(
            CategoryRule(
                pattern=pattern,
                match_type=match_type,
                category_id=category.id,
                priority=priority,
                is_active=True,
            )
        )
        print(f"  Created rule: {pattern} -> {category_name}")
    db.commit()


def _seed_targets(db) -> None:
    t = STARTER_TARGET
    existing = db.query(Target).filter(Target.name == t["name"]).first()
    if existing:
        print(f"  Skipped target (exists): {t['name']}")
        return

    category_id = None
    if t["category_name"]:
        category = db.query(Category).filter(Category.name == t["category_name"]).first()
        if category:
            category_id = category.id

    db.add(
        Target(
            name=t["name"],
            target_type=t["target_type"],
            direction=t["direction"],
            value=t["value"],
            tolerance_upper=t["tolerance_upper"],
            tolerance_lower=t["tolerance_lower"],
            period=t["period"],
            person_scope=t["person_scope"],
            category_id=category_id,
            description_pattern=t["description_pattern"],
            is_active=True,
        )
    )
    print(f"  Created target: {t['name']}")
    db.commit()


if __name__ == "__main__":
    seed()
