/**
 * Validate provider URL format
 */
export function validateProviderUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

/**
 * Validate chapter number
 */
export function validateChapterNumber(chapter: string): boolean {
  return /^\d+(\.\d+)?$/.test(chapter);
}

/**
 * Validate score (1-10)
 */
export function validateScore(score: number): boolean {
  return score >= 1 && score <= 10 && Number.isInteger(score);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
