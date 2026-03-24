/**
 * ProperSubs — Content Script
 *
 * Captures live subtitle cues from streaming site DOM elements via
 * MutationObserver and sends them to the transformation engine.
 * Works on Aniwave mirrors, FastStream players, and any site using
 * custom subtitle overlays.
 */

'use strict';

(() => {
  // ── State ──────────────────────────────────────────────────────────────
  let enabled = true;
  let debugMode = false;
  let lastCueText = '';
  let observer = null;
  let bodyObserver = null;
  let pollInterval = null;
  let subtitleElement = null;

  // Japanese detection: contains hiragana, katakana, or CJK ideographs
  const JP_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

  // ── Load settings from storage ─────────────────────────────────────────
  function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get({
        enabled: true,
        debugMode: false,
        customSelectors: '',
        displayMode: 'replace',
        timingOffset: 0
      }, settings => {
        if (chrome.runtime.lastError) {
          console.warn('[ProperSubs] Failed to load settings:', chrome.runtime.lastError);
          resolve({ enabled: true, debugMode: false, customSelectors: '', displayMode: 'replace', timingOffset: 0 });
          return;
        }
        enabled = settings.enabled;
        debugMode = settings.debugMode;
        resolve(settings);
      });
    });
  }

  // ── Subtitle element discovery ─────────────────────────────────────────
  // Selectors are sourced from ProperSubsSiteDetect to stay in sync with
  // site-detect.js. Falls back to generic attribute selectors if unavailable.
  const DEFAULT_SELECTORS = typeof ProperSubsSiteDetect !== 'undefined'
    ? ProperSubsSiteDetect.getAllSelectors()
    : ['[class*="subtitle"]', '[class*="caption"]'];

  function findSubtitleElement(customSelectors) {
    const selectors = [...DEFAULT_SELECTORS];

    // Append user-configured selectors
    if (customSelectors) {
      selectors.unshift(
        ...customSelectors.split(',').map(s => s.trim()).filter(Boolean)
      );
    }

    for (const selector of selectors) {
      // Skip pseudo-element selectors for querySelector
      if (selector.startsWith('::') || selector.includes('::cue')) continue;

      try {
        const el = document.querySelector(selector);
        if (el) {
          if (debugMode) console.log('[ProperSubs] Found subtitle element:', selector, el);
          return el;
        }
      } catch (e) {
        // Invalid selector — skip
      }
    }

    return null;
  }

  // ── Cue processing ────────────────────────────────────────────────────
  function extractText(element) {
    // Get visible text, stripping HTML tags but preserving line breaks
    const clone = element.cloneNode(true);
    // Convert <br> to newlines
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return (clone.textContent || '').trim();
  }

  function isJapanese(text) {
    return JP_REGEX.test(text);
  }

  function processCue(text) {
    if (!text || text === lastCueText) return;
    lastCueText = text;

    if (debugMode) {
      console.log('[ProperSubs] Cue captured:', text);
      console.log('[ProperSubs] Is Japanese:', isJapanese(text));
    }

    if (!isJapanese(text)) {
      if (debugMode) console.log('[ProperSubs] Skipping non-Japanese cue');
      return;
    }

    // Send to background service worker for transformation
    chrome.runtime.sendMessage({
      type: 'TRANSFORM_CUE',
      text: text,
      timestamp: Date.now()
    }, response => {
      if (chrome.runtime.lastError) {
        if (debugMode) console.error('[ProperSubs] Message error:', chrome.runtime.lastError);
        return;
      }
      if (response && response.structured) {
        if (debugMode) console.log('[ProperSubs] Transformed:', response.structured);
        requestAnimationFrame(() => {
          ProperSubsDisplay.render(subtitleElement, response.structured, text);
        });
      }
    });
  }

  // ── MutationObserver ──────────────────────────────────────────────────
  function startObserver(element) {
    if (observer) observer.disconnect();

    observer = new MutationObserver(mutations => {
      if (!enabled) return;

      for (const mutation of mutations) {
        // Text content changed or child nodes added/removed
        if (mutation.type === 'characterData' ||
            mutation.type === 'childList') {
          const text = extractText(element);
          if (text) processCue(text);
          break; // One mutation batch = one cue
        }
      }
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true
    });

    if (debugMode) console.log('[ProperSubs] MutationObserver started on:', element);
  }

  // ── Fallback: textTracks API ──────────────────────────────────────────
  function tryTextTracksAPI() {
    const video = document.querySelector('video');
    if (!video || !video.textTracks || video.textTracks.length === 0) return false;

    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];

      track.addEventListener('cuechange', () => {
        if (!enabled) return;
        const cue = track.activeCues && track.activeCues[0];
        if (cue && cue.text) {
          processCue(cue.text);
        }
      });

      // Ensure track is showing so cuechange fires
      if (track.mode === 'disabled') {
        track.mode = 'hidden';
      }
    }

    if (debugMode) console.log('[ProperSubs] Using textTracks API fallback');
    return true;
  }

  // ── Fallback: polling ─────────────────────────────────────────────────
  function startPolling(element) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(() => {
      if (!enabled) return;
      const text = extractText(element);
      if (text) processCue(text);
    }, 250);

    if (debugMode) console.log('[ProperSubs] Polling fallback started');
  }

  // ── Body observer cleanup ─────────────────────────────────────────────
  function cleanupBodyObserver() {
    if (bodyObserver) {
      bodyObserver.disconnect();
      bodyObserver = null;
      if (debugMode) console.log('[ProperSubs] Body observer disconnected');
    }
  }

  // ── Initialization ────────────────────────────────────────────────────
  async function init() {
    const settings = await loadSettings();

    if (!enabled) {
      if (debugMode) console.log('[ProperSubs] Extension disabled');
      return;
    }

    // Detect if this is a streaming site
    const siteInfo = typeof ProperSubsSiteDetect !== 'undefined'
      ? ProperSubsSiteDetect.detect()
      : null;

    if (debugMode && siteInfo) {
      console.log('[ProperSubs] Detected site:', siteInfo.name);
    }

    // Try to find subtitle element immediately
    subtitleElement = findSubtitleElement(settings.customSelectors);

    if (subtitleElement) {
      startObserver(subtitleElement);
      return;
    }

    // Element not found yet — wait for it (streaming sites load players dynamically)
    if (debugMode) console.log('[ProperSubs] No subtitle element found, watching for player load...');

    let bodyObserverDebounce = null;

    bodyObserver = new MutationObserver((mutations) => {
      // Debounce: only check after mutations settle (100ms)
      if (bodyObserverDebounce) clearTimeout(bodyObserverDebounce);
      bodyObserverDebounce = setTimeout(() => {
        // Quick check: were any nodes actually added?
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (!hasAddedNodes) return;

        subtitleElement = findSubtitleElement(settings.customSelectors);
        if (subtitleElement) {
          cleanupBodyObserver();
          startObserver(subtitleElement);
          if (debugMode) console.log('[ProperSubs] Subtitle element appeared, observer attached');
        }
      }, 100);
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try textTracks API as parallel fallback
    tryTextTracksAPI();

    // Disconnect body observer after 30s regardless — prevent memory leak on non-streaming pages
    setTimeout(() => {
      if (!subtitleElement) {
        subtitleElement = findSubtitleElement(settings.customSelectors);
        if (subtitleElement) {
          startPolling(subtitleElement);
        } else if (debugMode) {
          console.log('[ProperSubs] No subtitle element found after 30s timeout');
        }
      }
      cleanupBodyObserver();
    }, 30000);
  }

  // ── Listen for settings changes ────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    if (changes.enabled) {
      enabled = changes.enabled.newValue;
      if (debugMode) console.log('[ProperSubs] Enabled:', enabled);
    }
    if (changes.debugMode) {
      debugMode = changes.debugMode.newValue;
    }
    if (changes.customSelectors && enabled) {
      // Re-scan for subtitle element with new selectors
      subtitleElement = findSubtitleElement(changes.customSelectors.newValue);
      if (subtitleElement) startObserver(subtitleElement);
    }
  });

  // ── Listen for messages from popup/background ──────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'GET_STATUS': {
        // Run full media detection
        const detection = typeof ProperSubsDetector !== 'undefined'
          ? ProperSubsDetector.detect()
          : null;

        sendResponse({
          enabled: enabled,
          hasSubtitleElement: !!subtitleElement,
          lastCue: lastCueText,
          site: typeof ProperSubsSiteDetect !== 'undefined'
            ? ProperSubsSiteDetect.detect()
            : null,
          detection: detection
        });
        break;
      }

      case 'TOGGLE':
        enabled = msg.enabled;
        chrome.storage.sync.set({ enabled });
        sendResponse({ ok: true });
        break;

      default:
        return false;
    }
  });

  // ── Start ──────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
