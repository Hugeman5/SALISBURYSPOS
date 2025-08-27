export const VAT_RATE = 0.15; // South Africa 15%
export const fmtZAR = (v: number) => new Intl.NumberFormat('en-ZA', { style:'currency', currency:'ZAR' }).format(v);
export const addVat = (excl: number) => Math.round((excl * (1+VAT_RATE)) * 100) / 100;
export const splitVat = (incl: number) => {
  const excl = incl / (1+VAT_RATE);
  const vat  = incl - excl;
  return { excl: +excl.toFixed(2), vat: +vat.toFixed(2) };
};
