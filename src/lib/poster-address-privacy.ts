/**
 * Poster export only: remove a leading house number from the street line.
 * `cityState` is rendered separately and is not passed through this helper.
 *
 * @example redactPosterStreetNumber("32 Winterwind Ct") → "Winterwind Ct"
 * @example redactPosterStreetNumber("428 4th St · Unit 12") → "4th St · Unit 12"
 */
export function redactPosterStreetNumber(addressLine: string): string {
  const t = addressLine.trim();
  if (!t) return t;
  const redacted = t.replace(/^\d+\s*/, "").trim();
  return redacted.length > 0 ? redacted : t;
}

export function posterDisplayAddressLine(addressLine: string, privacyEnabled: boolean): string {
  if (!privacyEnabled) return addressLine.trim();
  return redactPosterStreetNumber(addressLine);
}
