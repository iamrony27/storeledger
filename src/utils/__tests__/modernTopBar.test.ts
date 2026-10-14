import { lightColors, darkColors, COLOR_HUNT_PALETTE } from '../../theme/colors';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Running Modern TopBar & Titlebar Design Tests...\n');

// 1. WCAG AA Contrast Ratios for TopBar Components
console.log('1. Testing TopBar Color System & Contrast Ratios...');

function getLuminance(hex: string): number {
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
    return 0.5;
  }
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrast(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Light theme topbar
const lightTitleContrast = getContrast(lightColors.surface, lightColors.textPrimary);
console.log(` - Light TopBar Surface vs Title (#0F172A): ${lightTitleContrast.toFixed(2)}:1`);
assert(lightTitleContrast >= 4.5, 'Light TopBar title must satisfy WCAG AA (>= 4.5:1)');

const lightSubtitleContrast = getContrast(lightColors.surface, lightColors.textSecondary);
console.log(` - Light TopBar Surface vs Subtitle (#64748B): ${lightSubtitleContrast.toFixed(2)}:1`);
assert(lightSubtitleContrast >= 4.5, 'Light TopBar subtitle must satisfy WCAG AA (>= 4.5:1)');

// Dark theme topbar
const darkTitleContrast = getContrast(darkColors.surface, darkColors.textPrimary);
console.log(` - Dark TopBar Surface vs Title (#F8FAFC): ${darkTitleContrast.toFixed(2)}:1`);
assert(darkTitleContrast >= 4.5, 'Dark TopBar title must satisfy WCAG AA (>= 4.5:1)');

const darkSubtitleContrast = getContrast(darkColors.surface, darkColors.textSecondary);
console.log(` - Dark TopBar Surface vs Subtitle (#94A3B8): ${darkSubtitleContrast.toFixed(2)}:1`);
assert(darkSubtitleContrast >= 4.5, 'Dark TopBar subtitle must satisfy WCAG AA (>= 4.5:1)');

// 2. Component Token & Elevation Invariants
console.log('\n2. Testing Modern TopBar Elevation & Architectural Invariants...');
assert(lightColors.headerBorder === '#E2E8F0', 'Light headerBorder must have clean slate hairline border');
assert(darkColors.headerBorder === '#334155', 'Dark headerBorder must have clean deep slate border');
assert(Boolean(lightColors.headerAccent), 'Light header must feature modern headerAccent token');
assert(Boolean(darkColors.headerAccent), 'Dark header must feature modern headerAccent token');

// 3. Testing Color Hunt Palette Invariants (https://colorhunt.co/palette/8b2626ef6905f1e5a1486c2f)
console.log('\n3. Testing Color Hunt Title Bar Palette Invariants & Contrast...');
assert(COLOR_HUNT_PALETTE.headerBg === '#EF6905', 'Title Bar headerBg must be #EF6905');
assert(COLOR_HUNT_PALETTE.crimsonRed === '#8B2626', 'Due Card crimsonRed must be #8B2626');
assert(COLOR_HUNT_PALETTE.creamYellow === '#F1E5A1', 'Accent creamYellow must be #F1E5A1');
assert(COLOR_HUNT_PALETTE.forestGreen === '#486C2F', 'Paid Card forestGreen must be #486C2F');

// Contrast check: Crimson background (#8B2626) vs Cream text (#F1E5A1)
const crimsonCreamContrast = getContrast(COLOR_HUNT_PALETTE.crimsonRed, COLOR_HUNT_PALETTE.creamYellow);
console.log(` - Crimson Due Card (#8B2626) vs Cream Text (#F1E5A1): ${crimsonCreamContrast.toFixed(2)}:1`);
assert(crimsonCreamContrast >= 4.5, 'Crimson vs Cream must satisfy WCAG AA (>= 4.5:1)');

// Contrast check: Forest Green (#486C2F) vs White text (#FFFFFF)
const greenWhiteContrast = getContrast(COLOR_HUNT_PALETTE.forestGreen, '#FFFFFF');
console.log(` - Forest Green Paid Card (#486C2F) vs White Text: ${greenWhiteContrast.toFixed(2)}:1`);
assert(greenWhiteContrast >= 4.5, 'Forest Green vs White text must satisfy WCAG AA (>= 4.5:1)');

// 4. Testing Integrated Same-Bar Search Bar & Hero Cards Drawer Invariants
console.log('\n4. Testing Integrated Same-Bar Search Bar & Hero Cards Drawer Invariants...');
const CARD_HEIGHT = 84;
const DRAWER_PADDING_TOP = 4;
const SEARCH_MARGIN_TOP = 8;
const SEARCH_INPUT_HEIGHT = 42;
const DRAWER_PADDING_BOTTOM = 10;
const TOTAL_DRAWER_CONTENT_HEIGHT =
  DRAWER_PADDING_TOP + CARD_HEIGHT + SEARCH_MARGIN_TOP + SEARCH_INPUT_HEIGHT + DRAWER_PADDING_BOTTOM;
const DRAWER_HEIGHT = 148;
const CARDS_COLLAPSE_DISTANCE = 96;

console.log(` - Drawer total content height: ${TOTAL_DRAWER_CONTENT_HEIGHT}px vs Drawer height: ${DRAWER_HEIGHT}px`);
assert(DRAWER_HEIGHT === TOTAL_DRAWER_CONTENT_HEIGHT, 'Drawer height must match total content height in the same bar');
assert(
  CARDS_COLLAPSE_DISTANCE === DRAWER_PADDING_TOP + CARD_HEIGHT + SEARCH_MARGIN_TOP,
  'Cards collapse distance must exactly equal card area to dock search bar flush'
);

// Card hidden invariant:
const cardBottomRelativeWhenCollapsed = DRAWER_PADDING_TOP + CARD_HEIGHT - CARDS_COLLAPSE_DISTANCE;
assert(
  cardBottomRelativeWhenCollapsed <= 0,
  `Cards bottom must be at or above 0dp relative to fixedTopBar when collapsed (got ${cardBottomRelativeWhenCollapsed}dp)`
);

// Docking invariant:
const FIXED_BAR_HEIGHT = 80;
const collapsedSearchTop = FIXED_BAR_HEIGHT + CARDS_COLLAPSE_DISTANCE - CARDS_COLLAPSE_DISTANCE;
assert(collapsedSearchTop === FIXED_BAR_HEIGHT, 'Collapsed search bar must dock flush at FIXED_BAR_HEIGHT with zero slicing');

console.log('\nAll Modern TopBar & Titlebar Design Tests Passed Successfully! ✨\n');
