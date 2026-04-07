/**
 * Max raw image size for POST /api/generate-listing-promo (JSON body is base64 — must stay under typical
 * ~4.5 MB platform request limits on Vercel).
 */
export const MAX_LISTING_PROMO_IMAGE_BYTES = Math.floor(2.5 * 1024 * 1024);
