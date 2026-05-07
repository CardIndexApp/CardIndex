/**
 * Card vs sealed product detection for Poketrace results.
 *
 * CARD:   has a cardNumber containing at least one digit AND name doesn't
 *         match known sealed-product patterns.
 *
 * SEALED: name positively matches known sealed-product keywords.
 *         This is intentionally a whitelist — unrecognised junk entries
 *         (e.g. "Grade Premium", grading submissions, accessories) are
 *         excluded from both buckets and filtered out at the call site.
 */

/** Used to exclude sealed products from card results */
const SEALED_NAME_RE = /\b(booster\s+box|booster\s+display|booster\s+bundle|booster\s+pack|booster\s+case|elite\s+trainer(\s+box)?|trainer\s+box|trainer\s+kit|starter\s+deck|theme\s+deck|battle\s+deck|blister\s+pack|blister|collection\s+box|collection\s+chest|premium\s+collection|special\s+collection|ultra\s+premium|gift\s+box|mini\s+tin|\btin\b|pokémon\s+box|pokemon\s+box|display\s+box|card\s+binder|playmat|pin\s+collection|figure\s+collection)\b/i

/** Positive whitelist — only returns true for recognisable sealed products */
const SEALED_PRODUCT_RE = /\b(booster\s+box|booster\s+display|booster\s+bundle|booster\s+pack|booster\s+case|elite\s+trainer(\s+box)?|trainer\s+box|trainer\s+kit|starter\s+deck|theme\s+deck|battle\s+deck|blister\s+pack|blister|collection\s+box|collection\s+chest|premium\s+collection|special\s+collection|ultra\s+premium|gift\s+box|mini\s+tin|\btin\b|pokémon\s+box|pokemon\s+box|display\s+box|card\s+binder|playmat|pin\s+collection|figure\s+collection)\b/i

export function isCardResult(card: {
  cardNumber?: string | null
  name?: string | null
}): boolean {
  // Must have a card number that contains at least one digit
  if (!card.cardNumber || !/\d/.test(card.cardNumber)) return false
  // Must not match sealed-product name patterns
  if (card.name && SEALED_NAME_RE.test(card.name)) return false
  return true
}

/**
 * Positive check: is this a recognisable sealed product?
 * Returns false for junk entries that are neither cards nor sealed products.
 */
export function isValidSealedProduct(card: {
  cardNumber?: string | null
  name?: string | null
}): boolean {
  // If it looks like a card, it's not sealed
  if (card.cardNumber && /\d/.test(card.cardNumber)) return false
  // Must positively match a known sealed product name pattern
  return !!(card.name && SEALED_PRODUCT_RE.test(card.name))
}

/** @deprecated Use isValidSealedProduct for positive detection */
export function isSealedResult(card: {
  cardNumber?: string | null
  name?: string | null
}): boolean {
  return isValidSealedProduct(card)
}
