import { fetchCurrencies, fetchLatestRates } from './api/frankfurter.js';
import {
  getState,
  subscribe,
  setSendAmount,
  setSendCurrency,
  setReceiveCurrency,
  setExchangeRate,
  setCurrencies,
  addFavorite,
  removeFavorite,
  isFavorite,
  addLogEntry
} from './services/state.js';
import { getFlagUrl } from './utils/flags.js';

// DOM Selectors
const sendInput = document.getElementById('send-input');
const receiveOutput = document.getElementById('receive-output');
const sendCurrencyBtn = document.getElementById('send-currency-btn');
const receiveCurrencyBtn = document.getElementById('receive-currency-btn');
const swapBtn = document.getElementById('swap');
const exchangeRateText = document.getElementById('exchange-rate-text');
const favoriteBtn = document.getElementById('favorite-btn');
const logBtn = document.getElementById('log-btn');

// Currency Picker Dialog elements
const currencyPicker = document.getElementById('currency-picker');
const closePickerBtn = document.getElementById('close-picker-btn');
const pickerSearchInput = document.getElementById('picker-search-input');
const popularList = document.getElementById('popular-list');
const otherList = document.getElementById('other-list');

// Keep track of which selector triggered the currency dialog ('send' or 'receive')
let activePickerSide = 'send';

/**
 * Fetches the latest exchange rate from the API and updates state
 */
async function updateExchangeRate() {
  const { sendCurrency, receiveCurrency } = getState();
  
  if (sendCurrency === receiveCurrency) {
    setExchangeRate(1.0);
    return;
  }
  
  try {
    const data = await fetchLatestRates(sendCurrency);
    const rate = data.rates[receiveCurrency];
    if (rate !== undefined) {
      setExchangeRate(rate);
    } else {
      throw new Error(`Rate for target currency "${receiveCurrency}" not available.`);
    }
  } catch (error) {
    alert(`Could not update exchange rate: ${error.message}`);
  }
}

/**
 * Renders currency options in the picker dialog lists
 */
function renderCurrencyList() {
  const { currencies, sendCurrency, receiveCurrency } = getState();
  const currentSelected = activePickerSide === 'send' ? sendCurrency : receiveCurrency;
  const oppositeSelected = activePickerSide === 'send' ? receiveCurrency : sendCurrency;
  
  const popularCodes = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY'];
  
  popularList.innerHTML = '';
  otherList.innerHTML = '';
  
  // Sort currency codes alphabetically
  const sortedCodes = Object.keys(currencies).sort();

  sortedCodes.forEach((code) => {
    const name = currencies[code];
    const isPopular = popularCodes.includes(code);
    const isSelected = code === currentSelected;
    const isOpposite = code === oppositeSelected;
    
    const li = document.createElement('li');
    li.className = `currency-item ${isSelected ? 'selected' : ''}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    li.setAttribute('data-code', code);
    
    // Disable selecting the same currency as the opposite side to prevent identity conversions
    if (isOpposite) {
      li.style.opacity = '0.5';
    }

    li.innerHTML = `
      <img src="${getFlagUrl(code)}" alt="" class="flag-icon" />
      <span class="currency-code">${code}</span>
      <span class="currency-name">${name}</span>
      <svg class="check-icon" viewBox="0 0 24 24" width="16" height="16">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;
    
    li.addEventListener('click', () => {
      if (activePickerSide === 'send') {
        setSendCurrency(code);
      } else {
        setReceiveCurrency(code);
      }
      updateExchangeRate();
      currencyPicker.close();
    });
    
    if (isPopular) {
      popularList.appendChild(li);
    } else {
      otherList.appendChild(li);
    }
  });
}

/**
 * Sets up the currency picker dialog trigger listeners
 */
function openPicker(side) {
  activePickerSide = side;
  pickerSearchInput.value = '';
  renderCurrencyList();
  currencyPicker.showModal();
  pickerSearchInput.focus();
}

// 1. Subscribe to State Changes & Update UI accordingly
subscribe((state) => {
  const convertedAmount = state.sendAmount * state.exchangeRate;
  
  // Safely update inputs to avoid cursor jumps during active editing
  if (document.activeElement !== sendInput) {
    sendInput.value = state.sendAmount || '';
  }
  if (document.activeElement !== receiveOutput) {
    receiveOutput.value = convertedAmount > 0 ? parseFloat(convertedAmount.toFixed(4)) : '';
  }
  
  // Update Send button code text and flag
  const sendBtnCode = sendCurrencyBtn.querySelector('.currency-code');
  const sendBtnFlag = sendCurrencyBtn.querySelector('.flag-icon');
  if (sendBtnCode) sendBtnCode.textContent = state.sendCurrency;
  if (sendBtnFlag) {
    sendBtnFlag.src = getFlagUrl(state.sendCurrency);
    sendBtnFlag.alt = `${state.sendCurrency} flag`;
  }
  
  // Update Receive button code text and flag
  const receiveBtnCode = receiveCurrencyBtn.querySelector('.currency-code');
  const receiveBtnFlag = receiveCurrencyBtn.querySelector('.flag-icon');
  if (receiveBtnCode) receiveBtnCode.textContent = state.receiveCurrency;
  if (receiveBtnFlag) {
    receiveBtnFlag.src = getFlagUrl(state.receiveCurrency);
    receiveBtnFlag.alt = `${state.receiveCurrency} flag`;
  }
  
  // Update exchange rate info text
  if (exchangeRateText) {
    exchangeRateText.textContent = `1 ${state.sendCurrency} = ${state.exchangeRate.toFixed(4)} ${state.receiveCurrency}`;
  }
  
  // Update Favorite button active state class & label
  const isFav = isFavorite(state.sendCurrency, state.receiveCurrency);
  favoriteBtn.textContent = isFav ? 'Favorited' : 'Favorite';
  if (isFav) {
    favoriteBtn.classList.add('active');
  } else {
    favoriteBtn.classList.remove('active');
  }
});

// 2. Event Listeners for Core Conversion Section
sendInput.addEventListener('input', () => {
  setSendAmount(sendInput.value);
});

receiveOutput.addEventListener('input', () => {
  const { exchangeRate } = getState();
  const receiveVal = parseFloat(receiveOutput.value) || 0;
  if (exchangeRate > 0) {
    setSendAmount(receiveVal / exchangeRate);
  }
});

swapBtn.addEventListener('click', () => {
  const { sendCurrency, receiveCurrency } = getState();
  setSendCurrency(receiveCurrency);
  setReceiveCurrency(sendCurrency);
  updateExchangeRate();
});

favoriteBtn.addEventListener('click', () => {
  const { sendCurrency, receiveCurrency } = getState();
  if (isFavorite(sendCurrency, receiveCurrency)) {
    removeFavorite(sendCurrency, receiveCurrency);
  } else {
    addFavorite(sendCurrency, receiveCurrency);
  }
});

logBtn.addEventListener('click', () => {
  const { sendCurrency, receiveCurrency, sendAmount, exchangeRate } = getState();
  const receiveAmount = sendAmount * exchangeRate;
  addLogEntry(sendCurrency, receiveCurrency, sendAmount, receiveAmount);
  
  // Add temporary button animation feedback
  const originalText = logBtn.textContent;
  logBtn.textContent = 'Logged!';
  logBtn.disabled = true;
  setTimeout(() => {
    logBtn.textContent = originalText;
    logBtn.disabled = false;
  }, 1000);
});

// 3. Currency Picker Dialog Events
sendCurrencyBtn.addEventListener('click', () => openPicker('send'));
receiveCurrencyBtn.addEventListener('click', () => openPicker('receive'));
closePickerBtn.addEventListener('click', () => currencyPicker.close());

// Close modal when clicking outside the dialog area
currencyPicker.addEventListener('click', (e) => {
  const rect = currencyPicker.getBoundingClientRect();
  if (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  ) {
    currencyPicker.close();
  }
});

// Live filtering of picker options on search
pickerSearchInput.addEventListener('input', () => {
  const term = pickerSearchInput.value.toLowerCase().trim();
  const items = currencyPicker.querySelectorAll('.currency-item');
  
  items.forEach((item) => {
    const code = item.querySelector('.currency-code').textContent.toLowerCase();
    const name = item.querySelector('.currency-name').textContent.toLowerCase();
    if (code.includes(term) || name.includes(term)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
});

// 4. App Initialization
async function init() {
  try {
    // Load available currencies
    const currencies = await fetchCurrencies();
    setCurrencies(currencies);
    
    // Update the visual currency metadata header
    const currencyCountEl = document.getElementById('currency-count');
    if (currencyCountEl) {
      const count = Object.keys(currencies).length;
      currencyCountEl.textContent = count;
    }
    
    // Retrieve latest rate to complete initial setup
    await updateExchangeRate();
  } catch (error) {
    console.error('App initialization failed:', error);
  }
}

// Start the application
init();
