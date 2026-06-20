/**
 * API service for interacting with the Frankfurter API v1.
 * Docs: https://www.frankfurter.app/docs/
 */

const BASE_URL = "https://api.frankfurter.dev/v1";

/**
 * Fetches the dictionary of all available currencies (code -> name).
 * Endpoint: GET /currencies
 * @returns {Promise<Record<string, string>>} Currency codes mapped to their full names
 */
export async function fetchCurrencies() {
  try {
    const response = await fetch(`${BASE_URL}/currencies`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch currencies: ${response.status} ${response.statusText}`,
      );
    }
    return await response.json();
  } catch (error) {
    console.error("Error in fetchCurrencies:", error);
    throw error;
  }
}

/**
 * Fetches the latest exchange rates relative to a base currency.
 * Endpoint: GET /latest?base=USD
 * @param {string} base - The base currency code (e.g., 'USD')
 * @returns {Promise<{base: string, date: string, rates: Record<string, number>}>} Latest rates data
 */
export async function fetchLatestRates(base) {
  if (!base) {
    throw new Error("Base currency is required to fetch latest rates.");
  }
  try {
    const response = await fetch(
      `${BASE_URL}/latest?base=${encodeURIComponent(base)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch latest rates for ${base}: ${response.status} ${response.statusText}`,
      );
    }
    return await response.json();
  } catch (error) {
    console.error(`Error in fetchLatestRates for ${base}:`, error);
    throw error;
  }
}

/**
 * Fetches historical rate data for a specific currency pair over a date range.
 * Endpoint: GET /2020-01-01..2020-12-31?base=USD&symbols=EUR
 * @param {string} base - The base currency code (e.g., 'USD')
 * @param {string} target - The target currency code (e.g., 'EUR')
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{base: string, start_date: string, end_date: string, rates: Record<string, Record<string, number>>}>} Historical rates data
 */
export async function fetchRateHistory(base, target, startDate, endDate) {
  if (!base || !target || !startDate || !endDate) {
    throw new Error(
      "Base, target, startDate, and endDate are all required to fetch rate history.",
    );
  }
  try {
    const url = `${BASE_URL}/${encodeURIComponent(startDate)}..${encodeURIComponent(endDate)}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(target)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch rate history (${base} -> ${target}): ${response.status} ${response.statusText}`,
      );
    }
    return await response.json();
  } catch (error) {
    console.error(`Error in fetchRateHistory (${base} -> ${target}):`, error);
    throw error;
  }
}
