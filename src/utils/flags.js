/**
 * Maps currency codes to their corresponding flag image filename.
 * Based on the webp flags present in assets/images/flags/
 */
const CURRENCY_FLAG_MAP = {
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  AUD: 'au',
  CAD: 'ca',
  JPY: 'jp',
  CNY: 'cn',
  HKD: 'hk',
  NZD: 'nz',
  SEK: 'se',
  NOK: 'no',
  DKK: 'dk',
  CHF: 'ch',
  SGD: 'sg',
  PLN: 'pl',
  TRY: 'tr',
  INR: 'in',
  MXN: 'mx',
  ZAR: 'za',
  BRL: 'br',
  KRW: 'kr',
  IDR: 'id',
  HUF: 'hu',
  CZK: 'cz',
  THB: 'th',
  MYR: 'my',
  PHP: 'ph',
  ISK: 'is',
  RON: 'ro',
  BGN: 'bg',
};

// List of all physically available flags in the folder to guarantee no 404s
const KNOWN_FLAGS = new Set([
  'ae', 'ar', 'au', 'bd', 'bg', 'bh', 'br', 'ca', 'ch', 'cl', 'cn', 'co', 'cy', 'cz', 
  'dk', 'eg', 'eu', 'gb', 'hk', 'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'in', 'is', 'jo', 
  'jp', 'ke', 'kr', 'kw', 'lb', 'lc', 'lk', 'ma', 'mx', 'my', 'ng', 'no', 'np', 'nz', 
  'om', 'pe', 'ph', 'pk', 'pl', 'qa', 'ro', 'ru', 'sa', 'se', 'sg', 'th', 'tr', 'tw', 
  'ua', 'us', 'vn', 'za'
]);

/**
 * Returns the local path to the webp flag image for a given currency code.
 * Falls back to 'eu.webp' if the currency does not have a mapped or physical flag.
 * 
 * @param {string} currencyCode - 3-letter currency code (e.g., 'USD')
 * @returns {string} Relative path to the webp flag asset
 */
export function getFlagUrl(currencyCode) {
  if (!currencyCode) return 'assets/images/flags/eu.webp';
  
  const codeUpper = currencyCode.toUpperCase();
  const flagName = CURRENCY_FLAG_MAP[codeUpper] || codeUpper.substring(0, 2).toLowerCase();
  
  if (KNOWN_FLAGS.has(flagName)) {
    return `assets/images/flags/${flagName}.webp`;
  }
  
  // Default fallback if no specific flag file matches
  return 'assets/images/flags/eu.webp';
}
