/**
 * WCAG 2.1 relative luminance and contrast ratio calculator.
 * Used for automated accessibility testing of theme color palettes.
 */

function parseHex(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean.slice(0, 6), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b];
}

function linearize(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

/**
 * Calculates relative luminance for an sRGB hex color according to WCAG 2.1.
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculates WCAG 2.1 contrast ratio between two hex colors (returns a value between 1 and 21).
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Validates WCAG AA conformance.
 * For normal text: minimum 4.5:1
 * For large text (bold >= 14pt or >= 18pt): minimum 3.0:1
 */
export function meetsWcagAA(hex1: string, hex2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(hex1, hex2);
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}
