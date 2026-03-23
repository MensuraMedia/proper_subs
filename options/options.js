'use strict';

const $ = id => document.getElementById(id);

// ── All setting keys with defaults ───────────────────────────────────────
// Sync storage: preferences (synced across Chrome instances)
const SYNC_DEFAULTS = {
  provider: 'groq',
  model: '',
  transformMode: 'llm',
  displayMode: 'replace',
  particleColors: true,
  fontSize: 100,
  opacity: 100,
  positionOffset: 0,
  timingOffset: 0,
  autoPause: false,
  customSelectors: '',
  debugMode: false,
  timeoutMs: 2000
};

// Local storage: secrets (never synced to Google)
const LOCAL_DEFAULTS = {
  apiKey: ''
};

// ── Load settings into form ──────────────────────────────────────────────
Promise.all([
  new Promise(resolve => chrome.storage.sync.get(SYNC_DEFAULTS, s => {
    if (chrome.runtime.lastError) {
      console.warn('[ProperSubs] Failed to load sync settings:', chrome.runtime.lastError);
      resolve(SYNC_DEFAULTS);
      return;
    }
    resolve(s);
  })),
  new Promise(resolve => chrome.storage.local.get(LOCAL_DEFAULTS, s => {
    if (chrome.runtime.lastError) {
      console.warn('[ProperSubs] Failed to load local settings:', chrome.runtime.lastError);
      resolve(LOCAL_DEFAULTS);
      return;
    }
    resolve(s);
  }))
]).then(([syncSettings, localSettings]) => {
  const settings = { ...syncSettings, ...localSettings };

  $('provider').value = settings.provider;
  $('api-key').value = settings.apiKey;
  $('model').value = settings.model;
  $('transform-mode').value = settings.transformMode;
  $('display-mode').value = settings.displayMode;
  $('particle-colors').checked = settings.particleColors;
  $('font-size').value = settings.fontSize;
  $('font-size-val').textContent = settings.fontSize + '%';
  $('opacity').value = settings.opacity;
  $('opacity-val').textContent = settings.opacity + '%';
  $('position-offset').value = settings.positionOffset;
  $('position-offset-val').textContent = settings.positionOffset + 'px';
  $('timing-offset').value = settings.timingOffset;
  $('timing-offset-val').textContent = settings.timingOffset + 'ms';
  $('auto-pause').checked = settings.autoPause;
  $('custom-selectors').value = settings.customSelectors;
  $('debug-mode').checked = settings.debugMode;
});

// ── Range slider live labels ─────────────────────────────────────────────
const RANGE_UNITS = {
  'font-size': '%',
  'opacity': '%',
  'position-offset': 'px',
  'timing-offset': 'ms'
};

Object.entries(RANGE_UNITS).forEach(([id, unit]) => {
  $(id).addEventListener('input', e => {
    $(`${id}-val`).textContent = e.target.value + unit;
  });
});

// ── Save ─────────────────────────────────────────────────────────────────
$('btn-save').addEventListener('click', () => {
  // Sync storage: preferences only
  const syncSettings = {
    provider: $('provider').value,
    model: $('model').value,
    transformMode: $('transform-mode').value,
    displayMode: $('display-mode').value,
    particleColors: $('particle-colors').checked,
    fontSize: parseInt($('font-size').value),
    opacity: parseInt($('opacity').value),
    positionOffset: parseInt($('position-offset').value),
    timingOffset: parseInt($('timing-offset').value),
    autoPause: $('auto-pause').checked,
    customSelectors: $('custom-selectors').value,
    debugMode: $('debug-mode').checked
  };

  // Local storage: API key (never synced)
  const localSettings = {
    apiKey: $('api-key').value
  };

  Promise.all([
    new Promise(resolve => chrome.storage.sync.set(syncSettings, resolve)),
    new Promise(resolve => chrome.storage.local.set(localSettings, resolve))
  ]).then(() => {
    const status = $('save-status');
    status.textContent = 'Settings saved';
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 2000);
  });
});

// ── Test API connection ──────────────────────────────────────────────────
$('btn-test').addEventListener('click', () => {
  const btn = $('btn-test');
  const result = $('test-result');
  btn.disabled = true;
  btn.textContent = 'Testing...';
  result.textContent = '';
  result.className = 'test-result';

  // Save current settings first so background uses them
  const syncSettings = {
    provider: $('provider').value,
    model: $('model').value,
    transformMode: $('transform-mode').value
  };
  const localSettings = {
    apiKey: $('api-key').value
  };

  Promise.all([
    new Promise(resolve => chrome.storage.sync.set(syncSettings, resolve)),
    new Promise(resolve => chrome.storage.local.set(localSettings, resolve))
  ]).then(() => {
    chrome.runtime.sendMessage({ type: 'TEST_API' }, response => {
      btn.disabled = false;
      btn.textContent = 'Test Connection';

      if (response && response.ok) {
        result.textContent = `Success: 私はリンゴを食べます。 → ${response.structured}`;
        result.classList.add('success');
      } else {
        result.textContent = `Error: ${response ? response.error : 'No response from background'}`;
        result.classList.add('error');
      }
    });
  });
});
