/**
 * ProperSubs — Background Service Worker
 *
 * Handles LLM API calls for subtitle transformation,
 * manages translation cache, and coordinates between
 * content script and popup/options.
 */

import { transformCue } from './lib/transformer.js';

// ── Translation cache (per tab, per session) ─────────────────────────────
const cache = new Map();

function getCacheKey(tabId, text) {
  return `${tabId}:${text}`;
}

function getCached(tabId, text) {
  return cache.get(getCacheKey(tabId, text));
}

function setCache(tabId, text, structured) {
  const key = getCacheKey(tabId, text);
  cache.set(key, structured);

  // Evict old entries (keep last 500 per session)
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

// ── Message handler ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TRANSFORM_CUE') {
    const tabId = sender.tab ? sender.tab.id : 0;

    // Check cache first
    const cached = getCached(tabId, msg.text);
    if (cached) {
      sendResponse({ structured: cached });
      return;
    }

    // Transform via LLM
    handleTransform(tabId, msg.text)
      .then(structured => sendResponse({ structured }))
      .catch(err => {
        console.error('[ProperSubs] Transform error:', err);
        sendResponse({ error: err.message });
      });

    return true; // Keep message channel open for async response
  }

  if (msg.type === 'CLEAR_CACHE') {
    cache.clear();
    sendResponse({ ok: true });
  }

  if (msg.type === 'TEST_API') {
    handleTransform(0, '私はリンゴを食べます。')
      .then(structured => sendResponse({ structured, ok: true }))
      .catch(err => sendResponse({ error: err.message, ok: false }));
    return true;
  }
});

// ── Transform handler ────────────────────────────────────────────────────
async function handleTransform(tabId, text) {
  const settings = await chrome.storage.sync.get({
    provider: 'groq',
    apiKey: '',
    model: '',
    transformMode: 'llm',   // 'llm' | 'offline'
    timeoutMs: 400
  });

  if (!settings.apiKey && settings.transformMode === 'llm') {
    return '[ProperSubs: No API key configured — open extension options]';
  }

  const structured = await transformCue(text, {
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    mode: settings.transformMode,
    timeoutMs: settings.timeoutMs
  });

  setCache(tabId, text, structured);
  return structured;
}

// ── Clean up cache when tab closes ───────────────────────────────────────
chrome.tabs.onRemoved.addListener(tabId => {
  for (const key of cache.keys()) {
    if (key.startsWith(`${tabId}:`)) {
      cache.delete(key);
    }
  }
});

// ── Install / update handler ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // Set defaults on first install
    chrome.storage.sync.set({
      enabled: true,
      debugMode: false,
      provider: 'groq',
      apiKey: '',
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
      timeoutMs: 400
    });
  }
});
