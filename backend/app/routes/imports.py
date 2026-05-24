from __future__ import annotations

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.csv_import import CsvImport
from app.schemas.csv_import import CsvImportResponse, ImportResultResponse
from app.services.importer import ImportService

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/upload", response_model=ImportResultResponse)
async def upload_csv(
    file: UploadFile,
    account_id: int = Form(...),
    db: Session = Depends(get_db),
) -> ImportResultResponse:
    """Upload a CSV file for processing.

    Returns 409 if the file has already been imported (duplicate detection
    via SHA-256 of file content).
    """
    content = await file.read()
    filename = file.filename or "unknown.csv"

    try:
        service = ImportService(db)
        result = service.import_csv(content, filename, account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Check for duplicate file
    if result.errors and "DUPLICATE_FILE" in result.errors:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "This file has already been imported.",
                "existing_import_id": result.csv_import_id,
            },
        )

    return ImportResultResponse(
        csv_import_id=result.csv_import_id,
        filename=result.filename,
        total_rows=result.total_rows,
        new_transactions=result.new_transactions,
        duplicate_transactions=result.duplicate_transactions,
        categorized_count=result.categorized_count,
        uncategorized_count=result.uncategorized_count,
        errors=result.errors,
    )


@router.get("", response_model=list[CsvImportResponse])
def list_imports(db: Session = Depends(get_db)) -> list[CsvImportResponse]:
    """List all past imports."""
    imports = db.query(CsvImport).order_by(CsvImport.imported_at.desc()).all()
    result = []
    for imp in imports:
        account_name = imp.account.name if imp.account else None
        result.append(
            CsvImportResponse(
                id=imp.id,
                filename=imp.filename,
                file_hash=imp.file_hash,
                imported_at=imp.imported_at,
                row_count=imp.row_count,
                new_transaction_count=imp.new_transaction_count,
                account_id=imp.account_id,
                account_name=account_name,
            )
        )
    return result
