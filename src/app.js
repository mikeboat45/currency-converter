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

// 4. Tab Navigation & Accessibility Events
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const tabpanels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

function switchTab(targetTab) {
  const targetPanelId = targetTab.getAttribute('aria-controls');
  
  tabs.forEach((tab) => {
    const isTarget = tab === targetTab;
    tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    tab.setAttribute('tabindex', isTarget ? '0' : '-1');
  });
  
  tabpanels.forEach((panel) => {
    const isTarget = panel.getAttribute('id') === targetPanelId;
    if (isTarget) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  // Persist the open tab selection
  localStorage.setItem('fx_checker_active_tab', targetTab.id);
}

function handleTabKeydown(e) {
  const currentTab = e.currentTarget;
  const index = tabs.indexOf(currentTab);
  let nextIndex;

  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = (index + 1) % tabs.length;
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = (index - 1 + tabs.length) % tabs.length;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = tabs.length - 1;
      break;
    default:
      return; // Let browser handle other keys
  }

  e.preventDefault();
  const nextTab = tabs[nextIndex];
  nextTab.focus();
  switchTab(nextTab);
}

// Bind events to tabs
tabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    switchTab(e.currentTarget);
  });
  tab.addEventListener('keydown', handleTabKeydown);
});

// Restore last active tab on load
const savedTabId = localStorage.getItem('fx_checker_active_tab');
if (savedTabId) {
  const savedTab = document.getElementById(savedTabId);
  if (savedTab) {
    switchTab(savedTab);
  }
}

// 5. App Initialization

/**
 * A helper to calculate a deterministic hourly seeded percentage change
 * based on the currency code. Keeps numbers stable within the same hour
 * but realistic in trend.
 */
function getSeededChange(code) {
  const hourStr = new Date().toISOString().split(':')[0]; // e.g. "2026-06-20T20"
  let hash = 0;
  const combined = code + hourStr;
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  const percent = (hash % 150) / 100; // range: -1.5% to +1.5%
  return percent;
}

/**
 * Initializes and populates the live market ticker marquee
 */
async function initTicker() {
  const tickerTrack = document.getElementById('ticker-track');
  if (!tickerTrack) return;

  try {
    // Fetch latest rates with USD as the base
    const data = await fetchLatestRates('USD');
    const rates = data.rates;

    // Define the list of major currency pairs to display
    const tickerPairs = [
      { pairName: 'EUR/USD', calculateRate: (r) => (1 / r.EUR).toFixed(4) },
      { pairName: 'GBP/USD', calculateRate: (r) => (1 / r.GBP).toFixed(4) },
      { pairName: 'USD/JPY', calculateRate: (r) => r.JPY.toFixed(2) },
      { pairName: 'AUD/USD', calculateRate: (r) => (1 / r.AUD).toFixed(4) },
      { pairName: 'USD/CAD', calculateRate: (r) => r.CAD.toFixed(4) },
      { pairName: 'USD/CHF', calculateRate: (r) => r.CHF.toFixed(4) },
      { pairName: 'USD/CNY', calculateRate: (r) => r.CNY.toFixed(4) },
      { pairName: 'NZD/USD', calculateRate: (r) => (1 / r.NZD).toFixed(4) },
      { pairName: 'USD/ZAR', calculateRate: (r) => r.ZAR.toFixed(2) }
    ];

    const tickerItemsHTML = tickerPairs
      .map((item) => {
        const rate = item.calculateRate(rates);
        // Extract target code for seed hash
        const targetCode = item.pairName.split('/')[1] === 'USD' 
          ? item.pairName.split('/')[0] 
          : item.pairName.split('/')[1];
        
        const changePercent = getSeededChange(targetCode);
        const isUp = changePercent >= 0;
        const arrow = isUp ? '▲' : '▼';
        const changeClass = isUp ? 'up' : 'down';

        return `
          <div class="ticker-item">
            <span class="ticker-pair">${item.pairName}</span>
            <span class="ticker-rate">${rate}</span>
            <span class="ticker-change ${changeClass}">${arrow} ${Math.abs(changePercent).toFixed(2)}%</span>
          </div>
        `;
      })
      .join('');

    // Duplicate ticker items to enable seamless, infinite loop scrolling via CSS translation
    tickerTrack.innerHTML = tickerItemsHTML + tickerItemsHTML;
  } catch (error) {
    console.error('Failed to initialize ticker track rates:', error);
    tickerTrack.innerHTML = '<span class="ticker-error">Live market feed temporarily offline</span>';
  }
}

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
    
    // Populate the live market ticker
    initTicker();
    
    // Retrieve latest rate to complete initial setup
    await updateExchangeRate();
  } catch (error) {
    console.error('App initialization failed:', error);
  }
}

// Start the application
init();
