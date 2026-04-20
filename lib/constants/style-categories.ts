/**
 * Style catalog category slugs — keep order and literals aligned with
 * `server/src/domain/style-categories.ts` (GET /styles and booking payloads).
 */
export const STYLE_CATEGORIES = [
  'hair',
  'nails',
  'skin',
  'waxing',
  'massage',
  'beauty',
  'wellness',
  'tanning',
  'piercing',
  'retail',
] as const;

export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

/** Tab order on the styles page (subset may appear if the catalog omits some). */
export const STYLE_CATEGORY_ORDER: readonly StyleCategory[] = STYLE_CATEGORIES;
