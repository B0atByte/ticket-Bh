// Validated categorical palette (see dataviz skill — references/palette.md).
// Fixed slot order, never cycled/regenerated: same 5 systems always map to
// the same slot. Light-mode values only — this app is plain-white throughout
// (no dark mode anywhere else in issues-dashboard), so charts match that.
export const SYSTEM_ORDER = ['Bhlogisticssystem', 'PRsystem', 'lms-casa', 'xBloom', 'QSC-Sytem'] as const

const SLOTS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a'] // blue, green, magenta, yellow, aqua

export function systemColor(system: string): string {
  const idx = SYSTEM_ORDER.indexOf(system as (typeof SYSTEM_ORDER)[number])
  return SLOTS[idx >= 0 ? idx : SLOTS.length - 1]
}

// Same 5-hue validated set as SYSTEM_ORDER, reused for a different dimension
// (category, not system) — each chart carries its own legend/direct labels,
// so the two dimensions never need to share a color meaning.
export const CATEGORY_ORDER = ['system_error', 'payment', 'account', 'feedback', 'other'] as const

export function categoryColor(category: string): string {
  const idx = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number])
  return SLOTS[idx >= 0 ? idx : SLOTS.length - 1]
}

// Sequential default hue (blue) — single-series trend line.
export const TREND_COLOR = '#2a78d6'

export const CHROME = {
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
}
