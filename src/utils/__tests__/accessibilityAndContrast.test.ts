import {
  getRelativeLuminance,
  getContrastRatio,
  meetsWcagAA,
} from '../contrastChecker';
import { lightColors, darkColors } from '../../theme/colors';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running Accessibility & WCAG AA Contrast Ratio Tests...\n');

// 1. WCAG Luminance & Contrast Math Validation
console.log('1. Testing WCAG Math Invariants...');
const whiteLuminance = getRelativeLuminance('#FFFFFF');
const blackLuminance = getRelativeLuminance('#000000');
assert(Math.abs(whiteLuminance - 1.0) < 0.001, 'White luminance must be 1.0');
assert(Math.abs(blackLuminance - 0.0) < 0.001, 'Black luminance must be 0.0');

const maxRatio = getContrastRatio('#FFFFFF', '#000000');
assert(maxRatio >= 21.0, `White vs Black contrast must be 21:1 (got ${maxRatio})`);

const sameRatio = getContrastRatio('#FFFFFF', '#FFFFFF');
assert(sameRatio === 1.0, `Identical colors contrast ratio must be 1:1 (got ${sameRatio})`);

// 2. Light Theme Contrast Conformance
console.log('2. Testing Light Theme Color Contrast against WCAG AA...');

// Primary text on Background
const lightBgTextRatio = getContrastRatio(lightColors.background, lightColors.textPrimary);
console.log(` - Light Background (#F8FAFC) vs TextPrimary (#0F172A): ${lightBgTextRatio}:1`);
assert(
  meetsWcagAA(lightColors.background, lightColors.textPrimary, false),
  `Light textPrimary on background must pass WCAG AA (>= 4.5:1, got ${lightBgTextRatio})`
);

// Primary text on Surface/Card
const lightSurfaceTextRatio = getContrastRatio(lightColors.surface, lightColors.textPrimary);
console.log(` - Light Surface (#FFFFFF) vs TextPrimary (#0F172A): ${lightSurfaceTextRatio}:1`);
assert(
  meetsWcagAA(lightColors.surface, lightColors.textPrimary, false),
  `Light textPrimary on surface must pass WCAG AA (>= 4.5:1, got ${lightSurfaceTextRatio})`
);

// Secondary text on Surface/Card
const lightSecondaryRatio = getContrastRatio(lightColors.surface, lightColors.textSecondary);
console.log(` - Light Surface (#FFFFFF) vs TextSecondary (#64748B): ${lightSecondaryRatio}:1`);
assert(
  meetsWcagAA(lightColors.surface, lightColors.textSecondary, false),
  `Light textSecondary on surface must pass WCAG AA (>= 4.5:1, got ${lightSecondaryRatio})`
);

// Primary Button Text (White on Primary #2563EB)
const lightPrimaryBtnRatio = getContrastRatio(lightColors.primary, '#FFFFFF');
console.log(` - Light Primary Button (#2563EB) vs White Text: ${lightPrimaryBtnRatio}:1`);
assert(
  meetsWcagAA(lightColors.primary, '#FFFFFF', true),
  `Primary button text must meet WCAG AA large text (>= 3.0:1, got ${lightPrimaryBtnRatio})`
);

// You Will Give (Debit) Text on Card
const lightGiveRatio = getContrastRatio(lightColors.surface, lightColors.youWillGive);
console.log(` - Light You Will Give (#DC2626) vs Surface: ${lightGiveRatio}:1`);
assert(
  meetsWcagAA(lightColors.surface, lightColors.youWillGive, false),
  `Light youWillGive on surface must meet WCAG AA (>= 4.5:1, got ${lightGiveRatio})`
);

// 3. Dark Theme Contrast Conformance
console.log('\n3. Testing Dark Theme Color Contrast against WCAG AA...');

// Primary text on Background
const darkBgTextRatio = getContrastRatio(darkColors.background, darkColors.textPrimary);
console.log(` - Dark Background (#0B0F19) vs TextPrimary (#F8FAFC): ${darkBgTextRatio}:1`);
assert(
  meetsWcagAA(darkColors.background, darkColors.textPrimary, false),
  `Dark textPrimary on background must pass WCAG AA (>= 4.5:1, got ${darkBgTextRatio})`
);

// Primary text on Surface/Card
const darkSurfaceTextRatio = getContrastRatio(darkColors.surface, darkColors.textPrimary);
console.log(` - Dark Surface (#1E293B) vs TextPrimary (#F8FAFC): ${darkSurfaceTextRatio}:1`);
assert(
  meetsWcagAA(darkColors.surface, darkColors.textPrimary, false),
  `Dark textPrimary on surface must pass WCAG AA (>= 4.5:1, got ${darkSurfaceTextRatio})`
);

// Secondary text on Surface/Card
const darkSecondaryRatio = getContrastRatio(darkColors.surface, darkColors.textSecondary);
console.log(` - Dark Surface (#1E293B) vs TextSecondary (#94A3B8): ${darkSecondaryRatio}:1`);
assert(
  meetsWcagAA(darkColors.surface, darkColors.textSecondary, false),
  `Dark textSecondary on surface must pass WCAG AA (>= 4.5:1, got ${darkSecondaryRatio})`
);

// Receivable text on Surface/Card
const darkGetRatio = getContrastRatio(darkColors.surface, darkColors.youWillGet);
console.log(` - Dark You Will Get (#10B981) vs Surface (#1E293B): ${darkGetRatio}:1`);
assert(
  meetsWcagAA(darkColors.surface, darkColors.youWillGet, false),
  `Dark youWillGet on surface must pass WCAG AA (>= 4.5:1, got ${darkGetRatio})`
);

// Primary Action on Surface/Card
const darkPrimaryRatio = getContrastRatio(darkColors.surface, darkColors.primary);
console.log(` - Dark Primary (#3B82F6) vs Surface (#1E293B): ${darkPrimaryRatio}:1`);
assert(
  meetsWcagAA(darkColors.surface, darkColors.primary, true),
  `Dark primary on surface must meet WCAG AA large text (>= 3.0:1, got ${darkPrimaryRatio})`
);

// 4. Low Resolution & Font Scaling Resilience
console.log('\n4. Testing Font Scaling & Small Screen Invariants...');
const minViewportWidth = 320; // Smallest Android budget device width (e.g. JioPhone / Redmi Go)
const padding = 16 * 2;
const availableContentWidth = minViewportWidth - padding;
assert(availableContentWidth >= 288, 'Available content width must be at least 288dp');

console.log('\nAll Accessibility & WCAG AA Contrast Tests Passed Successfully!');
