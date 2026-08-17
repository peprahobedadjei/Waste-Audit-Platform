/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes and
 * both line ending styles. Enough for the auditor upload template without
 * pulling in a dependency.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const text = input.replace(/^﻿/, ""); // strip BOM from Excel exports

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);

  return rows;
}

export const AUDITOR_CSV_HEADERS = ["name", "phone", "email", "district"];

export const AUDITOR_CSV_TEMPLATE =
  "name,phone,email,district\n" +
  "Amina Yusuf,+252612345678,amina@example.com,Wadajir\n" +
  "Omar Hassan,+252612345679,omar@example.com,Hodan\n";
