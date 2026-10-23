---
name: design-mobile-apps
description: Mobile app design system and implementation skill following the Sleek design guidelines and Quiet Ledger / Quiet Almanac aesthetic.
---

# Design Mobile Apps — Quiet Ledger Edition

## 1. Design Philosophy: Quiet Ledger & Quiet Almanac
"Considered. Earthy. Almanac-grade. A calm, literary aesthetic—the visual register of a hand-bound notebook left open on a wooden desk."

Rather than hyper-polished, neon, or sterile fintech dashboards, Quiet Ledger prioritizes:
- **Calm, Editorial Finance**: Low-distraction, psychological serenity, uncluttered typography.
- **Earthy, Considered Palette**: Deep forest charcoal, warm parchment cream, muted olive taupe, antique bronze, terracotta debit, and forest sage credit.
- **Data-Dense Elegance**: Tabular numerals, clean hairline dividers, generous margins, and subtle tactile states.
- **Subtle Surface Logic**: Surfaces step up through subtle lightness and warm tone shifts rather than aggressive drop shadows or glossy borders.

## 2. Color Tokens

### Dark Mode (Quiet Charcoal & Forest Slate)
- Background: `#0B0E0D` (Deepest forest charcoal)
- Card Surface: `#131916` (Grounded dark slate)
- Elevated Surface: `#1A221E` (Raised card / input surface)
- Primary / Accent: `#2D7D72` (Muted editorial teal) / `#37968B`
- Secondary / Antique Accent: `#A68A68` (Warm antique bronze)
- Text Primary: `#EDEAE2` (Warm linen / ivory)
- Text Secondary: `#9E9C91` (Muted taupe)
- Text Tertiary: `#6C6A60` (Subdued olive stone)
- Border / Hairline: `#232B26` / `rgba(237, 234, 226, 0.08)`
- Debit / "You Gave": `#C85A3E` (Warm terracotta / clay)
- Credit / "You Got": `#357960` (Grounded forest sage)
- Container / Chip Background: `#171E1A`

### Light Mode (Warm Linen & Editorial Parchment)
- Background: `#F5F2EB` (Warm natural parchment)
- Card Surface: `#FFFFFF` (Crisp paper white)
- Elevated Surface: `#EDE9DF` (Warm stone surface)
- Primary / Accent: `#1F6359` (Deep editorial teal)
- Secondary / Antique Accent: `#8A6F4E` (Antique bronze)
- Text Primary: `#181D1A` (Deep forest ink)
- Text Secondary: `#5C5A52` (Warm charcoal taupe)
- Text Tertiary: `#8C897E` (Soft olive gray)
- Border / Hairline: `#E2DDD2`
- Debit / "You Gave": `#B84E33` (Terracotta)
- Credit / "You Got": `#286A51` (Deep sage)
- Container / Chip Background: `#EBE6DC`

## 3. Typography & Numerals
- Font style: Clean, legible sans (Inter / system sans) with tabular figures for currency.
- Strict typographic scale:
  - Display: 28-32px, font weight 700, -0.5px letter spacing.
  - Heading: 20-22px, font weight 600, -0.3px letter spacing.
  - Subheading / Section: 13-14px, uppercase or small caps with 0.5px letter spacing, font weight 600.
  - Body: 15-16px, line height 22px, regular/medium.
  - Caption / Meta: 12-13px, font weight 500.

## 4. Component Rules
- **Header**: Quiet, dignified header with warm ivory/ink text and subtle date/account badges.
- **Summary Cards**: Grounded cards with hairline borders (`1px`), clean metric labels, and soft terracotta/sage pills.
- **List Items**: Ledger-style rows with clean dividers, squircle initials, dual-script support, and clear debit/credit columns.
- **Action Buttons**: Solid, tactile buttons with natural terracotta (`#C85A3E`) and forest sage (`#357960`) fills, rounded corners (12-16px), and matte finishes.
- **Dock / Rail Navigation**: Minimal, unobtrusive dock or rail with muted active indicator and soft natural highlight.
