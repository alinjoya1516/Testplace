/** Compares identifiers so that TC-LOG-01.2 comes before TC-LOG-01.10. */
export const naturalOrder = new Intl.Collator('en', { numeric: true }).compare;
