/**
 * Client-side CSV export helper.
 * Uses semicolon separator for German Excel compatibility.
 */

function escapeCsvValue(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  // Wrap in quotes if it contains semicolons, quotes, or newlines
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(';');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(';'));
  return [headerLine, ...dataLines].join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const csv = buildCsv(headers, rows);
  // BOM for German Excel UTF-8 recognition
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
