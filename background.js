/**
 * ProperSubs — Background Service Worker
 *
 * Handles LLM API calls for subtitle transformation,
 * manages translation cache via chrome.storage.session,
 * and coordinates between content script and popup/options.
 */

import { transformCue } from './lib/transformer.js';

// ── Session-based cache (survives SW termination, clears on browser close) ──
const CACHE_PREFIX = 'cache:';
const MAX_CACHE_ENTRIES = 500;

async function getCached(tabId, text) {
  const key = `${CACHE_PREFIX}${tabId}:${text}`;
  try {
    const result = await chrome.storage.session.get(key);
    return result[key] || null;
  } catch {
    return null;
  }
}

async function setCache(tabId, text, structured) {
  const key = `${CACHE_PREFIX}${tabId}:${text}`;
  try {
    await chrome.storage.session.set({ [key]: structured });

    // Evict oldest entries if cache is too large
    const all = await chrome.storage.session.get(null);
    const cacheKeys = Object.keys(all).filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > MAX_CACHE_ENTRIES) {
      const toRemove = cacheKeys.slice(0, cacheKeys.length - MAX_CACHE_ENTRIES);
      await chrome.storage.session.remove(toRemove);
    }
  } catch (err) {
    console.warn('[ProperSubs] Cache write failed:', err);
  }
}

async function clearCacheForTab(tabId) {
  try {
    const all = await chrome.storage.session.get(null);
    const toRemove = Object.keys(all).filter(k => k.startsWith(`${CACHE_PREFIX}${tabId}:`));
    if (toRemove.length > 0) {
      await chrome.storage.session.remove(toRemove);
    }
  } catch (err) {
    console.warn('[ProperSubs] Cache cleanup failed:', err);
  }
}

// ── Settings helpers ────────────────────────────────────────────────────
// API key is stored in chrome.storage.local (never synced to Google).
// All other preferences are in chrome.storage.sync.
async function getTransformSettings() {
  const [syncSettings, localSettings] = await Promise.all([
    chrome.storage.sync.get({
      provider: 'groq',
      model: '',
      transformMode: 'llm',
      timeoutMs: 2000
    }),
    chrome.storage.local.get({ apiKey: '' })
  ]);
  return { ...syncSettings, ...localSettings };
}

// ── Message handler ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'TRANSFORM_CUE': {
      const tabId = sender.tab ? sender.tab.id : 0;

      // Check cache first
      getCached(tabId, msg.text).then(cached => {
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
      });

      return true; // Keep message channel open for async response
    }

    case 'CLEAR_CACHE': {
      chrome.storage.session.clear()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    case 'TEST_API': {
      handleTransform(0, '私はリンゴを食べます。')
        .then(structured => sendResponse({ structured, ok: true }))
        .catch(err => sendResponse({ error: err.message, ok: false }));
      return true;
    }

    default:
      return false;
  }
});

// ── Transform handler ───────────────────────────────────────────────────
async function handleTransform(tabId, text) {
  const settings = await getTransformSettings();

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

// ── Clean up cache when tab closes ──────────────────────────────────────
chrome.tabs.onRemoved.addListener(tabId => {
  clearCacheForTab(tabId);
});

// ── Install / update handler ────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // Sync storage: preferences only (no secrets)
    chrome.storage.sync.set({
      enabled: true,
      debugMode: false,
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
      timeoutMs: 2000
    });

    // Local storage: secrets (never synced)
    chrome.storage.local.set({
      apiKey: ''
    });
  }
});
