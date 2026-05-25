from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import (
    accounts,
    categories,
    category_rules,
    dashboard,
    household_members,
    imports,
    targets,
    transactions,
)

app = FastAPI(
    title="BudgetOnTarget",
    description="Personal household spending dashboard API",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(transactions.router, prefix=settings.api_prefix)
app.include_router(categories.router, prefix=settings.api_prefix)
app.include_router(category_rules.router, prefix=settings.api_prefix)
app.include_router(targets.router, prefix=settings.api_prefix)
app.include_router(imports.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
app.include_router(household_members.router, prefix=settings.api_prefix)
app.include_router(accounts.router, prefix=settings.api_prefix)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "version": "0.1.0"}
