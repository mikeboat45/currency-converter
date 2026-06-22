import { fetchCurrencies, fetchLatestRates, fetchRateHistory } from './api/frankfurter.js';
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
  addLogEntry,
  setActiveChartRange,
  setChartRates,
  deleteLogEntry,
  clearLog
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
const clearAllLogBtn = document.getElementById('clear-all-log-btn');

// Currency Picker Dialog elements
const currencyPicker = document.getElementById('currency-picker');
const closePickerBtn = document.getElementById('close-picker-btn');
const pickerSearchInput = document.getElementById('picker-search-input');
const popularList = document.getElementById('popular-list');
const otherList = document.getElementById('other-list');

// Keep track of which selector triggered the currency dialog ('send' or 'receive')
let activePickerSide = 'send';
let searchAnnounceTimeout;

// Chart state variables
let lastFetchedHistoryKey = '';
let activeChartData = null;
let chartResizeObserver = null;

// Compare Panel cache variables
let lastFetchedCompareBase = '';
let cachedCompareRates = null;

/**
 * Utility to announce dynamic visual updates to screen reader users
 * @param {string} message - Announcement text
 */
function announceToScreenReader(message) {
  const announcer = document.getElementById('a11y-announcer');
  if (announcer) {
    announcer.textContent = '';
    // Small timeout ensures screen readers register the DOM update
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  }
}

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
    
    // Disable keyboard focus and mouse interactions if it's the opposite selected currency
    if (isOpposite) {
      li.style.opacity = '0.5';
      li.setAttribute('tabindex', '-1');
      li.setAttribute('aria-disabled', 'true');
    } else {
      li.setAttribute('tabindex', '0');
    }

    li.innerHTML = `
      <img src="${getFlagUrl(code)}" alt="" class="flag-icon" />
      <span class="currency-code">${code}</span>
      <span class="currency-name">${name}</span>
      <svg class="check-icon" viewBox="0 0 24 24" width="16" height="16">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;
    
    const handleSelect = () => {
      if (isOpposite) return;
      if (activePickerSide === 'send') {
        setSendCurrency(code);
      } else {
        setReceiveCurrency(code);
      }
      updateExchangeRate();
      currencyPicker.close();
      announceToScreenReader(`Selected ${code} (${name}) as ${activePickerSide === 'send' ? 'send' : 'receive'} currency.`);
    };

    li.addEventListener('click', handleSelect);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
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
  announceToScreenReader(`Select ${side === 'send' ? 'send' : 'receive'} currency picker dialog opened. Tab down to browse currencies or type to filter.`);
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

  // Update History Range Buttons visual state
  const activeRange = state.activeChartRange;
  document.querySelectorAll('.range-btn').forEach((btn) => {
    const isSelected = btn.getAttribute('data-range').toUpperCase() === activeRange.toUpperCase();
    btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    if (isSelected) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Refresh history chart if needed
  updateHistoryPanelIfNeeded();

  // Refresh compare list if visible
  updateComparePanel();

  // Refresh favorites list if visible
  updateFavoritesPanel();

  // Refresh conversion log if visible
  updateLogPanel();
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
    announceToScreenReader(`Removed ${sendCurrency} to ${receiveCurrency} from favorites.`);
  } else {
    addFavorite(sendCurrency, receiveCurrency);
    announceToScreenReader(`Added ${sendCurrency} to ${receiveCurrency} to favorites.`);
  }
});

logBtn.addEventListener('click', () => {
  const { sendCurrency, receiveCurrency, sendAmount, exchangeRate } = getState();
  const receiveAmount = sendAmount * exchangeRate;
  addLogEntry(sendCurrency, receiveCurrency, sendAmount, receiveAmount);
  announceToScreenReader(`Logged conversion of ${sendAmount.toLocaleString()} ${sendCurrency} to ${receiveAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${receiveCurrency}.`);
  
  // Add temporary button animation feedback
  const originalText = logBtn.textContent;
  logBtn.textContent = 'Logged!';
  logBtn.disabled = true;
  setTimeout(() => {
    logBtn.textContent = originalText;
    logBtn.disabled = false;
  }, 1000);
});

if (clearAllLogBtn) {
  clearAllLogBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire conversion log?')) {
      clearLog();
      announceToScreenReader('Cleared entire conversion log history.');
    }
  });
}

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
  let visibleCount = 0;
  
  items.forEach((item) => {
    const code = item.querySelector('.currency-code').textContent.toLowerCase();
    const name = item.querySelector('.currency-name').textContent.toLowerCase();
    if (code.includes(term) || name.includes(term)) {
      item.style.display = '';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  // Debounce search count announcements so screen reader doesn't speak on every keystroke
  clearTimeout(searchAnnounceTimeout);
  searchAnnounceTimeout = setTimeout(() => {
    announceToScreenReader(`Found ${visibleCount} currencies matching "${term || 'all'}".`);
  }, 500);
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

  // If switching to the history tab, trigger a check/redraw of the chart
  if (targetTab.id === 'tab-history') {
    updateHistoryPanelIfNeeded();
  }

  // If switching to the compare tab, trigger an update of the compare list
  if (targetTab.id === 'tab-compare') {
    updateComparePanel();
  }

  // If switching to the favorites tab, trigger an update of the favorites list
  if (targetTab.id === 'tab-favorites') {
    updateFavoritesPanel();
  }

  // If switching to the log tab, trigger an update of the conversion log
  if (targetTab.id === 'tab-log') {
    updateLogPanel();
  }
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

// Bind range selectors
document.querySelectorAll('.range-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const range = btn.getAttribute('data-range').toUpperCase();
    setActiveChartRange(range);
  });
});

/**
 * Calculates start date based on the active range
 */
function getStartDateForRange(range) {
  const end = new Date();
  let start = new Date();

  switch (range.toLowerCase()) {
    case '1d':
      start.setDate(end.getDate() - 5); // 5 days ago to ensure at least 2 EOD points
      break;
    case '1w':
      start.setDate(end.getDate() - 7);
      break;
    case '1m':
      start.setMonth(end.getMonth() - 1);
      break;
    case '3m':
      start.setMonth(end.getMonth() - 3);
      break;
    case '1y':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case '5y':
      start.setFullYear(end.getFullYear() - 5);
      break;
    default:
      start.setMonth(end.getMonth() - 1);
  }
  
  return start.toISOString().split('T')[0];
}

/**
 * Draws the rate history chart inside an HTML5 Canvas context
 */
function drawChart(canvas, dates, rates) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Background color matching dark mode theme
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  if (dates.length < 2) return;

  const paddingLeft = 55;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const rateRange = maxRate - minRate;
  
  const pad = rateRange === 0 ? 0.05 : rateRange * 0.15;
  const yMin = minRate - pad;
  const yMax = maxRate + pad;
  const yRange = yMax - yMin;

  const getX = (index) => paddingLeft + (index / (dates.length - 1)) * chartWidth;
  const getY = (rate) => paddingTop + chartHeight - ((rate - yMin) / yRange) * chartHeight;

  // 1. Draw horizontal grid lines & Y labels (Low, Mid, High)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.font = '10px "CustomFont", monospace';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const gridCount = 3;
  for (let i = 0; i <= gridCount; i++) {
    const rateVal = yMin + (i / gridCount) * yRange;
    const y = getY(rateVal);

    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillText(rateVal.toFixed(4), paddingLeft - 8, y);
  }

  // 2. Draw vertical grid ticks & X labels (Dates)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const xLabelCount = Math.min(dates.length, 4);
  const step = Math.max(1, Math.floor((dates.length - 1) / (xLabelCount - 1)));
  
  for (let i = 0; i < dates.length; i += step) {
    const index = (i + step >= dates.length && i !== dates.length - 1) ? dates.length - 1 : i;
    const x = getX(index);
    
    ctx.beginPath();
    ctx.moveTo(x, paddingTop + chartHeight);
    ctx.lineTo(x, paddingTop + chartHeight + 4);
    ctx.stroke();

    const d = new Date(dates[index]);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    ctx.fillText(dateStr, x, paddingTop + chartHeight + 8);
    
    if (index === dates.length - 1) break;
  }

  // 3. Draw gradient area under chart line
  const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  grad.addColorStop(0, 'rgba(173, 255, 47, 0.18)');
  grad.addColorStop(1, 'rgba(173, 255, 47, 0.0)');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(getX(0), paddingTop + chartHeight);
  for (let i = 0; i < dates.length; i++) {
    ctx.lineTo(getX(i), getY(rates[i]));
  }
  ctx.lineTo(getX(dates.length - 1), paddingTop + chartHeight);
  ctx.closePath();
  ctx.fill();

  // 4. Draw chart stroke line
  ctx.strokeStyle = 'greenyellow';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(getX(0), getY(rates[0]));
  for (let i = 1; i < dates.length; i++) {
    ctx.lineTo(getX(i), getY(rates[i]));
  }
  ctx.stroke();

  // 5. Draw glowing latest rate indicator point at the end
  const lastX = getX(dates.length - 1);
  const lastY = getY(rates[rates.length - 1]);
  
  ctx.fillStyle = 'greenyellow';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(173, 255, 47, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 7, 0, 2 * Math.PI);
  ctx.stroke();
}

/**
 * Initializes and debounces the resize observer for responsive redraws
 */
function initChartResizeObserver(canvas, dates, rates) {
  if (chartResizeObserver) {
    chartResizeObserver.disconnect();
  }
  chartResizeObserver = new ResizeObserver(() => {
    drawChart(canvas, dates, rates);
  });
  chartResizeObserver.observe(canvas.parentElement);
}

/**
 * Fetches rate history from the API and renders the chart and stats panels
 */
async function updateHistoryPanel() {
  const { sendCurrency, receiveCurrency, activeChartRange } = getState();
  const loadingEl = document.getElementById('chart-loading');
  const errorEl = document.getElementById('chart-error');
  const canvas = document.getElementById('history-chart');

  if (!canvas) return;

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = getStartDateForRange(activeChartRange);

  try {
    const data = await fetchRateHistory(sendCurrency, receiveCurrency, startDate, endDate);
    const dates = Object.keys(data.rates).sort();
    
    if (dates.length === 0) {
      throw new Error('No historical rate data returned for the selected range.');
    }
    
    const rates = dates.map(date => data.rates[date][receiveCurrency]);

    // Save to local cache for resize observer
    activeChartData = { dates, rates };

    // Calculate statistical differences
    const openVal = rates[0];
    const lastVal = rates[rates.length - 1];
    const changeVal = lastVal - openVal;
    const pctChangeVal = (changeVal / openVal) * 100;

    // Update statistics UI DOM elements
    const openEl = document.getElementById('history-open');
    const lastEl = document.getElementById('history-last');
    const changeEl = document.getElementById('history-change');
    const pctChangeEl = document.getElementById('history-pct-change');

    if (openEl) openEl.textContent = openVal.toFixed(4);
    if (lastEl) lastEl.textContent = lastVal.toFixed(4);
    
    if (changeEl) {
      changeEl.textContent = `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(4)}`;
      changeEl.className = `stat-value ${changeVal >= 0 ? 'up' : 'down'}`;
    }
    
    if (pctChangeEl) {
      pctChangeEl.textContent = `${changeVal >= 0 ? '▲' : '▼'} ${Math.abs(pctChangeVal).toFixed(2)}%`;
      pctChangeEl.className = `stat-value ${changeVal >= 0 ? 'up' : 'down'}`;
    }

    // Update headers and text metadata
    const titleEl = document.getElementById('chart-pair-title');
    const metaEl = document.getElementById('chart-pair-meta');
    
    if (titleEl) titleEl.textContent = `${sendCurrency}/${receiveCurrency}`;
    if (metaEl) {
      const lastDate = new Date(dates[dates.length - 1]);
      const dateStr = lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      metaEl.textContent = `${lastVal.toFixed(4)} · ${dateStr}`;
    }

    if (loadingEl) loadingEl.classList.add('hidden');

    // Draw the canvas elements and attach resize trigger
    drawChart(canvas, dates, rates);
    initChartResizeObserver(canvas, dates, rates);

  } catch (err) {
    console.error('Failed to load history chart data:', err);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      const errorMsgEl = document.getElementById('chart-error-msg');
      if (errorMsgEl) {
        errorMsgEl.textContent = `We couldn't load rate history for ${sendCurrency}/${receiveCurrency} right now: ${err.message}`;
      }
    }
    
    // Clear canvas on error
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
    }
  }
}

/**
 * Checks visibility before triggering updateHistoryPanel to prevent redundant fetches
 */
async function updateHistoryPanelIfNeeded() {
  const tabHistory = document.getElementById('tab-history');
  if (tabHistory && tabHistory.getAttribute('aria-selected') !== 'true') {
    return;
  }

  const { sendCurrency, receiveCurrency, activeChartRange } = getState();
  const currentKey = `${sendCurrency}-${receiveCurrency}-${activeChartRange}`;

  if (currentKey === lastFetchedHistoryKey) {
    const canvas = document.getElementById('history-chart');
    if (canvas && activeChartData) {
      drawChart(canvas, activeChartData.dates, activeChartData.rates);
    }
    return;
  }

  lastFetchedHistoryKey = currentKey;
  await updateHistoryPanel();
}

/**
 * Renders the multi-currency comparison list in real-time
 */
async function updateComparePanel() {
  const tabCompare = document.getElementById('tab-compare');
  if (tabCompare && tabCompare.getAttribute('aria-selected') !== 'true') {
    return;
  }

  const { sendCurrency, sendAmount, currencies } = getState();
  const compareList = document.getElementById('compare-list');
  const compareEmpty = document.getElementById('compare-empty');
  const compareSendDesc = document.getElementById('compare-send-desc');
  const compareRowsCount = document.getElementById('compare-rows-count');

  if (!compareList) return;

  // 1. If Send Amount is empty or zero, show empty state prompt
  if (!sendAmount || sendAmount <= 0) {
    compareList.innerHTML = '';
    if (compareSendDesc) compareSendDesc.textContent = `0.00 from ${sendCurrency}`;
    if (compareRowsCount) {
      compareRowsCount.textContent = '0 pairs';
      compareRowsCount.classList.remove('badge');
    }
    if (compareEmpty) compareEmpty.classList.remove('hidden');
    return;
  }

  if (compareEmpty) compareEmpty.classList.add('hidden');

  try {
    let rates = cachedCompareRates;

    // 2. Fetch rates if cache is empty or if base currency changed
    if (sendCurrency !== lastFetchedCompareBase || !rates) {
      const data = await fetchLatestRates(sendCurrency);
      rates = data.rates;
      cachedCompareRates = rates;
      lastFetchedCompareBase = sendCurrency;
    }

    // 3. Filter other currencies (excluding the send base currency itself) and sort
    const targetCodes = Object.keys(currencies)
      .filter((code) => code !== sendCurrency)
      .sort();

    if (compareSendDesc) {
      compareSendDesc.textContent = `${sendAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${sendCurrency}`;
    }
    if (compareRowsCount) {
      compareRowsCount.textContent = `${targetCodes.length} pairs`;
      compareRowsCount.classList.add('badge');
    }

    // 4. Clear and rebuild the list elements dynamically
    compareList.innerHTML = '';

    targetCodes.forEach((code) => {
      const rate = rates[code];
      if (rate === undefined) return; // Skip if API rate is not available

      const name = currencies[code];
      const convertedVal = sendAmount * rate;
      const isFav = isFavorite(sendCurrency, code);

      const li = document.createElement('li');
      li.className = 'compare-row';
      li.setAttribute('role', 'option');

      li.innerHTML = `
        <div class="compare-currency-info">
          <img src="${getFlagUrl(code)}" alt="" class="flag-icon" />
          <div class="currency-text">
            <span class="compare-code">${code}</span>
            <span class="compare-name">${name}</span>
          </div>
        </div>
        <div class="compare-values">
          <span class="compare-converted">${convertedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
          <span class="compare-rate">@ ${rate.toFixed(4)}</span>
        </div>
        <button type="button" class="pin-btn ${isFav ? 'active' : ''}" aria-label="${isFav ? 'Unpin favorite' : 'Pin favorite'}">
          <svg class="star-icon" viewBox="0 0 24 24" width="20" height="20">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </button>
      `;

      // Handle Pin/Unpin actions
      const pinBtn = li.querySelector('.pin-btn');
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid loading the clicked currency as base
        if (isFavorite(sendCurrency, code)) {
          removeFavorite(sendCurrency, code);
          announceToScreenReader(`Removed ${sendCurrency} to ${code} from favorites.`);
        } else {
          addFavorite(sendCurrency, code);
          announceToScreenReader(`Added ${sendCurrency} to ${code} to favorites.`);
        }
      });

      // Quick action: clicking a comparison row loads it back into the converter as Receive currency
      li.addEventListener('click', () => {
        setReceiveCurrency(code);
        updateExchangeRate();
      });

      compareList.appendChild(li);
    });

  } catch (error) {
    console.error('Failed to update compare list:', error);
    compareList.innerHTML = `<li class="compare-error">Failed to load live exchange rates: ${error.message}</li>`;
  }
}

/**
 * Renders the favorites panel dynamically with grouped rate fetching
 */
async function updateFavoritesPanel() {
  const tabFavorites = document.getElementById('tab-favorites');
  if (tabFavorites && tabFavorites.getAttribute('aria-selected') !== 'true') {
    return;
  }

  const favoritesList = document.getElementById('favorites-list');
  const favoritesEmpty = document.getElementById('favorites-empty');
  const favoritesLoading = document.getElementById('favorites-loading');
  const favoritesCountDesc = document.getElementById('favorites-count-desc');

  if (!favoritesList) return;

  const { favorites } = getState();

  // 1. Update favorites count
  if (favoritesCountDesc) {
    favoritesCountDesc.textContent = `${favorites.length} pair${favorites.length === 1 ? '' : 's'}`;
  }

  // 2. Handle empty state
  if (favorites.length === 0) {
    favoritesList.innerHTML = '';
    if (favoritesEmpty) favoritesEmpty.classList.remove('hidden');
    if (favoritesLoading) favoritesLoading.classList.add('hidden');
    return;
  }

  if (favoritesEmpty) favoritesEmpty.classList.add('hidden');
  if (favoritesLoading) favoritesLoading.classList.remove('hidden');

  try {
    // 3. Group by unique base currencies to optimize API requests
    const uniqueBases = Array.from(new Set(favorites.map(fav => fav.base)));

    // 4. Fetch rates for all unique bases concurrently
    const fetchedData = await Promise.all(
      uniqueBases.map(async (base) => {
        try {
          const data = await fetchLatestRates(base);
          return { base, rates: data.rates };
        } catch (err) {
          console.error(`Failed to fetch rates for favorite base ${base}:`, err);
          return { base, rates: null };
        }
      })
    );

    // Map base -> rates for quick lookup
    const ratesMap = {};
    fetchedData.forEach(({ base, rates }) => {
      if (rates) {
        ratesMap[base] = rates;
      }
    });

    // Check if the tab is still active after the async call to avoid race conditions
    if (tabFavorites.getAttribute('aria-selected') !== 'true') {
      return;
    }

    if (favoritesLoading) favoritesLoading.classList.add('hidden');
    favoritesList.innerHTML = '';

    // 5. Render favorites rows
    favorites.forEach(({ base, target }) => {
      const baseRates = ratesMap[base];
      const rate = baseRates ? baseRates[target] : null;

      const li = document.createElement('li');
      li.className = 'favorite-row';
      li.setAttribute('role', 'option');

      if (rate === null || rate === undefined) {
        // Fallback for failed fetches
        li.innerHTML = `
          <div class="favorite-pair-info">
            <img src="${getFlagUrl(base)}" alt="" class="flag-icon" />
            <div class="favorite-code-block">
              <span>${base}</span>
              <span class="favorite-arrow">→</span>
              <span>${target}</span>
            </div>
            <img src="${getFlagUrl(target)}" alt="" class="flag-icon" />
          </div>
          <div class="favorite-values">
            <span class="favorite-rate" style="color: #666; font-size: 0.85rem;">Unavailable</span>
          </div>
          <button type="button" class="pin-btn active" aria-label="Unpin favorite">
            <svg class="star-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
        `;
      } else {
        const changePercent = getSeededChange(target);
        const isUp = changePercent >= 0;
        const arrow = isUp ? '▲' : '▼';
        const changeClass = isUp ? 'up' : 'down';

        li.innerHTML = `
          <div class="favorite-pair-info">
            <img src="${getFlagUrl(base)}" alt="" class="flag-icon" />
            <div class="favorite-code-block">
              <span>${base}</span>
              <span class="favorite-arrow">→</span>
              <span>${target}</span>
            </div>
            <img src="${getFlagUrl(target)}" alt="" class="flag-icon" />
          </div>
          <div class="favorite-values">
            <span class="favorite-rate">${rate.toFixed(4)}</span>
            <span class="favorite-change ${changeClass}">${arrow} ${Math.abs(changePercent).toFixed(2)}%</span>
          </div>
          <button type="button" class="pin-btn active" aria-label="Unpin favorite">
            <svg class="star-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
        `;
      }

      // Hook up pin button click to remove from favorites
      const pinBtn = li.querySelector('.pin-btn');
      if (pinBtn) {
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Avoid setting the active pair in the main converter
          removeFavorite(base, target);
          announceToScreenReader(`Removed ${base} to ${target} from favorites.`);
        });
      }

      // Hook up row click to load the pinned pair back into the main converter
      li.addEventListener('click', () => {
        setSendCurrency(base);
        setReceiveCurrency(target);
        updateExchangeRate();
      });

      favoritesList.appendChild(li);
    });

  } catch (error) {
    console.error('Failed to update favorites panel:', error);
    if (favoritesLoading) favoritesLoading.classList.add('hidden');
    favoritesList.innerHTML = `<li class="compare-error">Failed to load favorite rates: ${error.message}</li>`;
  }
}

/**
 * Formats a timestamp into a relative time string (e.g., "Just now", "2 mins ago")
 * @param {number} timestamp - The epoch time to format
 * @returns {string} Relative time description
 */
function getRelativeTimeString(timestamp) {
  const elapsed = Date.now() - timestamp;
  const msPerMinute = 60 * 1000;
  const msPerHour = msPerMinute * 60;
  const msPerDay = msPerHour * 24;

  if (elapsed < msPerMinute) {
    return 'Just now';
  } else if (elapsed < msPerHour) {
    const mins = Math.round(elapsed / msPerMinute);
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  } else if (elapsed < msPerDay) {
    const hours = Math.round(elapsed / msPerHour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else {
    const days = Math.round(elapsed / msPerDay);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
}

/**
 * Renders the conversion log dynamically
 */
function updateLogPanel() {
  const tabLog = document.getElementById('tab-log');
  if (tabLog && tabLog.getAttribute('aria-selected') !== 'true') {
    return;
  }

  const logList = document.getElementById('log-list');
  const logEmpty = document.getElementById('log-empty');
  const logCountDesc = document.getElementById('log-count-desc');
  const clearAllBtn = document.getElementById('clear-all-log-btn');

  if (!logList) return;

  const { conversionLog } = getState();

  // 1. Update count metadata
  if (logCountDesc) {
    logCountDesc.textContent = `${conversionLog.length} logged`;
  }

  // 2. Control visibility of the "Clear all" button
  if (clearAllBtn) {
    if (conversionLog.length > 0) {
      clearAllBtn.classList.remove('hidden');
    } else {
      clearAllBtn.classList.add('hidden');
    }
  }

  // 3. Handle empty state UI
  if (conversionLog.length === 0) {
    logList.innerHTML = '';
    if (logEmpty) logEmpty.classList.remove('hidden');
    return;
  }

  if (logEmpty) logEmpty.classList.add('hidden');

  logList.innerHTML = '';

  // 4. Render log rows dynamically
  conversionLog.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'log-row';
    li.setAttribute('role', 'option');

    const timeFormatted = getRelativeTimeString(entry.timestamp);

    li.innerHTML = `
      <div class="log-meta">
        <span class="log-time">${timeFormatted}</span>
        <span class="log-pair">${entry.from} → ${entry.to}</span>
      </div>
      <div class="log-amounts">
        <span class="log-amount-from">${entry.amountFrom.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${entry.from}</span>
        <span class="log-amount-to">${entry.amountTo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${entry.to}</span>
      </div>
      <button type="button" class="delete-log-btn" aria-label="Delete log entry">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
        </svg>
      </button>
    `;

    // Hook up individual log item delete button
    const deleteBtn = li.querySelector('.delete-log-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid setting converter values
        deleteLogEntry(entry.id);
        announceToScreenReader(`Deleted conversion log entry for ${entry.amountFrom.toLocaleString()} ${entry.from} to ${entry.amountTo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${entry.to}.`);
      });
    }

    // Hook up row click to load the converted state back into the main inputs
    li.addEventListener('click', () => {
      setSendAmount(entry.amountFrom);
      setSendCurrency(entry.from);
      setReceiveCurrency(entry.to);
      updateExchangeRate();
    });

    logList.appendChild(li);
  });
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
