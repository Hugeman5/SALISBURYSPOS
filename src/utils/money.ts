export const VAT_RATE = 0.15; // South Africa 15%

/**
 * Formats a number in cents to a ZAR currency string (e.g., 12345 -> R 123.45).
 * @param cents The value in cents.
 * @returns A formatted currency string.
 */
export const fmtZAR = (cents: number) => {
  const rand = (cents || 0) / 100;
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(rand);
};

/**
 * Parses a string value (e.g., "123.45") into cents.
 * @param value The string value to parse.
 * @returns The value in cents, or 0 if parsing fails.
 */
export const parseToCents = (value: string): number => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 0;
  }
  return Math.round(num * 100);
};

export const addVat = (excl: number) => Math.round(excl * (1 + VAT_RATE));
export const splitVat = (incl: number) => {
  const excl = Math.round(incl / (1 + VAT_RATE));
  const vat = incl - excl;
  return { excl, vat };
};
