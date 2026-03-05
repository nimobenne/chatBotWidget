export function csvEscape(value: unknown): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const head = headers.map(csvEscape).join(',');
  const body = rows
    .map((row) => headers.map((h) => csvEscape(row[h])).join(','))
    .join('\n');
  return `${head}\n${body}`;
}
