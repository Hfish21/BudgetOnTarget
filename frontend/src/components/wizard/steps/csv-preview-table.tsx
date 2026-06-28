"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FieldMappingConfig } from "@/lib/local-engine/csv-parser-generic";

interface CsvPreviewTableProps {
  sampleRows: Record<string, string>[];
  config: FieldMappingConfig;
}

export function CsvPreviewTable({ sampleRows, config }: CsvPreviewTableProps) {
  const { mapping, amountMode } = config;

  if (sampleRows.length === 0) return null;

  const hasRequiredFields =
    mapping.dateColumn &&
    mapping.descriptionColumn &&
    (amountMode === "single" ? mapping.amountColumn : mapping.debitColumn || mapping.creditColumn);

  if (!hasRequiredFields) {
    return (
      <p className="text-sm text-muted-foreground">
        Map the required fields above to see a preview.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px] text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleRows.map((row, i) => {
            const date = mapping.dateColumn ? row[mapping.dateColumn] ?? "" : "";
            const desc = mapping.descriptionColumn
              ? row[mapping.descriptionColumn] ?? ""
              : "";

            let amount = "";
            if (amountMode === "single" && mapping.amountColumn) {
              amount = row[mapping.amountColumn] ?? "";
            } else {
              const debit = mapping.debitColumn ? row[mapping.debitColumn] ?? "" : "";
              const credit = mapping.creditColumn ? row[mapping.creditColumn] ?? "" : "";
              amount = credit && parseFloat(credit) ? `+${credit}` : debit ? `-${debit}` : "";
            }

            return (
              <TableRow key={i}>
                <TableCell className="text-xs">{date}</TableCell>
                <TableCell className="max-w-[300px] truncate text-xs">
                  {desc}
                </TableCell>
                <TableCell className="text-right text-xs font-mono">
                  {amount}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
