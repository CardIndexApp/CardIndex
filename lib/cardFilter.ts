/**
 * Filters Poketrace card results to exclude sealed products
 * (booster boxes, bundles, tins, decks, etc.).
 *
 * Two checks, both must pass:
 *
 * 1. cardNumber must contain at least one digit.
 *    Real cards always have a number (e.g. "6", "25/102", "SWSH001").
 *    Sealed products return null, undefined, or an empty string.
 *
 * 2. Name must not match known sealed-product patterns.
 *    Belt-and-suspenders in case a product somehow gets a cardNumber.
 */

const SEALED_RE = /\b(booster\s+box|booster\s+bundle|booster\s+pack|elite\s+trainer(\s+box)?|trainer\s+box|starter\s+deck|theme\s+deck|blister\s+pack|collection\s+box|collection\s+chest|premium\s+collection|special\s+collection|gift\s+box|v\s*[- ]?tin|celebrations\s+tin|pokémon\s+box|pokemon\s+box)\b/i

export function isCardResult(card: {
  cardNumber?: string | null
  name?: string | null
}): boolean {
  // Must have a card number that contains at least one digit
  if (!card.cardNumber || !/\d/.test(card.cardNumber)) return false
  // Must not match sealed-product name patterns
  if (card.name && SEALED_RE.test(card.name)) return false
  return true
}
