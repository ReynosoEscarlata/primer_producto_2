export function toNumberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}
