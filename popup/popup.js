'use strict';

const $ = id => document.getElementById(id);

// ── Load current settings ────────────────────────────────────────────────
chrome.storage.sync.get({
  enabled: true,
  displayMode: 'replace',
  provider: 'groq',
  particleColors: true
}, settings => {
  if (chrome.runtime.lastError) {
    console.warn('[ProperSubs] Failed to load popup settings:', chrome.runtime.lastError);
    return;
  }
  $('toggle-enabled').checked = settings.enabled;
  $('display-mode').value = settings.displayMode;
  $('provider').value = settings.provider;
  $('particle-colors').checked = settings.particleColors;
});

// ── Query content script for status ──────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (!tabs[0]) return;

  chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }, response => {
    const status = $('status');
    const lastCue = $('last-cue');

    if (chrome.runtime.lastError || !response) {
      status.textContent = 'Not active on this page';
      status.classList.add('inactive');
      return;
    }

    if (response.site) {
      status.textContent = `Connected: ${response.site.name}`;
      status.classList.add('active');
    } else if (response.hasSubtitleElement) {
      status.textContent = 'Subtitle element found';
      status.classList.add('active');
    } else {
      status.textContent = 'Waiting for subtitles...';
    }

    if (response.lastCue) {
      lastCue.textContent = response.lastCue;
    }
  });
});

// ── Event handlers ───────────────────────────────────────────────────────
$('toggle-enabled').addEventListener('change', e => {
  const enabled = e.target.checked;
  chrome.storage.sync.set({ enabled });

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled }, () => {
        // Ignore errors if content script not loaded on this tab
        if (chrome.runtime.lastError) return;
      });
    }
  });
});

$('display-mode').addEventListener('change', e => {
  chrome.storage.sync.set({ displayMode: e.target.value });
});

$('provider').addEventListener('change', e => {
  chrome.storage.sync.set({ provider: e.target.value });
});

$('particle-colors').addEventListener('change', e => {
  chrome.storage.sync.set({ particleColors: e.target.checked });
});

$('btn-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

$('btn-test').addEventListener('click', () => {
  const btn = $('btn-test');
  const lastCue = $('last-cue');
  btn.disabled = true;
  btn.textContent = 'Testing...';

  chrome.runtime.sendMessage({ type: 'TEST_API' }, response => {
    btn.disabled = false;
    btn.textContent = 'Test API';

    if (response && response.ok) {
      lastCue.textContent = response.structured;
      lastCue.classList.add('success');
    } else {
      lastCue.textContent = response ? response.error : 'No response';
      lastCue.classList.add('error');
    }

    setTimeout(() => lastCue.classList.remove('success', 'error'), 3000);
  });
});
