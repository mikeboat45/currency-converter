/**
 * State Management Service
 * Manages the application state and synchronizes with localStorage.
 */

// Keys for localStorage persistence
const LOCAL_STORAGE_KEYS = {
  FAVORITES: 'fx_checker_favorites',
  CONVERSION_LOG: 'fx_checker_log',
  SEND_CURRENCY: 'fx_checker_send_currency',
  RECEIVE_CURRENCY: 'fx_checker_receive_currency',
};

// 1. Initial State Definition
const state = {
  sendAmount: 1000,
  sendCurrency: loadFromLocalStorage(LOCAL_STORAGE_KEYS.SEND_CURRENCY, 'USD'),
  receiveCurrency: loadFromLocalStorage(LOCAL_STORAGE_KEYS.RECEIVE_CURRENCY, 'EUR'),
  exchangeRate: 1.0,

  // Available currencies fetched from API
  currencies: {}, // format: { USD: "United States Dollar", ... }

  // Ticker rates (live market updates)
  tickerRates: [], // format: [ { base: 'USD', target: 'EUR', rate: 0.92, change24h: 0.15 }, ... ]

  // Favorites (persisted list of currency pairs)
  favorites: loadFromLocalStorage(LOCAL_STORAGE_KEYS.FAVORITES, []),

  // Active chart range & rates
  activeChartRange: '1M', // '1D', '1W', '1M', '3M', '1Y', '5Y'
  chartRates: {}, // format: { '2026-06-01': { EUR: 0.92 }, ... }

  // Conversion Log (persisted list of logged calculations)
  conversionLog: loadFromLocalStorage(LOCAL_STORAGE_KEYS.CONVERSION_LOG, []),
};

// 2. Subscription System
const listeners = new Set();

/**
 * Subscribes a callback to state changes.
 * @param {Function} listener - Callback function receiving the updated state
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  // Run immediately to sync initial state
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Notifies all subscribers of a state change.
 */
function notify() {
  const stateCopy = { ...state };
  listeners.forEach((listener) => {
    try {
      listener(stateCopy);
    } catch (err) {
      console.error('Error in state subscriber:', err);
    }
  });
}

// 3. LocalStorage Helpers
function loadFromLocalStorage(key, defaultValue) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error(`Failed to parse localStorage key "${key}":`, e);
    return defaultValue;
  }
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save to localStorage key "${key}":`, e);
  }
}

// 4. State Selectors (Getters)
export function getState() {
  return { ...state };
}

// 5. Granular Setters
export function setSendAmount(amount) {
  const parsed = parseFloat(amount);
  state.sendAmount = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  notify();
}

export function setSendCurrency(code) {
  if (!code || state.sendCurrency === code) return;
  state.sendCurrency = code;
  saveToLocalStorage(LOCAL_STORAGE_KEYS.SEND_CURRENCY, code);
  notify();
}

export function setReceiveCurrency(code) {
  if (!code || state.receiveCurrency === code) return;
  state.receiveCurrency = code;
  saveToLocalStorage(LOCAL_STORAGE_KEYS.RECEIVE_CURRENCY, code);
  notify();
}

export function setExchangeRate(rate) {
  const parsed = parseFloat(rate);
  state.exchangeRate = isNaN(parsed) ? 1.0 : parsed;
  notify();
}

export function setCurrencies(currenciesObj) {
  state.currencies = currenciesObj || {};
  notify();
}

export function setTickerRates(ratesArray) {
  state.tickerRates = ratesArray || [];
  notify();
}

export function setActiveChartRange(range) {
  state.activeChartRange = range;
  notify();
}

export function setChartRates(ratesObj) {
  state.chartRates = ratesObj || {};
  notify();
}

// Favorite management (persisted)
export function addFavorite(base, target) {
  if (!base || !target || base === target) return;
  
  // Check if already favorited
  const exists = state.favorites.some(
    (fav) => fav.base === base && fav.target === target
  );
  if (exists) return;

  state.favorites.push({ base, target });
  saveToLocalStorage(LOCAL_STORAGE_KEYS.FAVORITES, state.favorites);
  notify();
}

export function removeFavorite(base, target) {
  state.favorites = state.favorites.filter(
    (fav) => !(fav.base === base && fav.target === target)
  );
  saveToLocalStorage(LOCAL_STORAGE_KEYS.FAVORITES, state.favorites);
  notify();
}

export function isFavorite(base, target) {
  return state.favorites.some(
    (fav) => fav.base === base && fav.target === target
  );
}

// Conversion log management (persisted)
export function addLogEntry(from, to, amountFrom, amountTo) {
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: Date.now(),
    from,
    to,
    amountFrom: parseFloat(amountFrom),
    amountTo: parseFloat(amountTo),
  };

  state.conversionLog.unshift(newEntry); // newest entries first
  saveToLocalStorage(LOCAL_STORAGE_KEYS.CONVERSION_LOG, state.conversionLog);
  notify();
}

export function deleteLogEntry(id) {
  state.conversionLog = state.conversionLog.filter((entry) => entry.id !== id);
  saveToLocalStorage(LOCAL_STORAGE_KEYS.CONVERSION_LOG, state.conversionLog);
  notify();
}

export function clearLog() {
  state.conversionLog = [];
  saveToLocalStorage(LOCAL_STORAGE_KEYS.CONVERSION_LOG, state.conversionLog);
  notify();
}
