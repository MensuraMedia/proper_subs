/**
 * ProperSubs — Subtitle Display Renderer
 *
 * Renders transformed structured English subtitles with
 * color-coded particles. All DOM updates inside requestAnimationFrame
 * for zero video stutter.
 */

'use strict';

const ProperSubsDisplay = (() => {
  // Regex to validate CSS color values (hex only — prevents XSS injection)
  const VALID_COLOR = /^#[0-9a-fA-F]{3,8}$/;

  // Known Japanese particles for color-coding
  const PARTICLE_COLORS = {
    wa: '#5b9bd5',    // blue
    ga: '#5b9bd5',    // blue
    o: '#e06666',     // red
    wo: '#e06666',    // red
    ni: '#6aa84f',    // green
    de: '#d4a017',    // amber
    kara: '#b07cd8',  // purple
    made: '#b07cd8',  // purple
    to: '#e69138',    // orange
    mo: '#5b9bd5',    // blue
    no: '#999999',    // gray
    he: '#6aa84f',    // green
    e: '#6aa84f',     // green
    yo: '#cc6699',    // pink
    ne: '#cc6699',    // pink
    ka: '#cc6699',    // pink
    na: '#cc6699',    // pink
    ze: '#cc6699',    // pink
  };

  // Regex to match particles as standalone words
  const PARTICLE_REGEX = new RegExp(
    '\\b(' + Object.keys(PARTICLE_COLORS).join('|') + ')\\b', 'gi'
  );

  let overlayElement = null;
  let currentSettings = {
    displayMode: 'replace',
    particleColors: true,
    fontSize: 100,
    opacity: 100,
    positionOffset: 0
  };

  const INAUDIBLE = '[ inaudible ]';

  // ── Load display settings ──────────────────────────────────────────────
  function loadSettings() {
    chrome.storage.sync.get({
      displayMode: 'replace',
      particleColors: true,
      fontSize: 100,
      opacity: 100,
      positionOffset: 0,
      customParticleColors: null
    }, settings => {
      if (chrome.runtime.lastError) {
        console.warn('[ProperSubs] Failed to load display settings:', chrome.runtime.lastError);
        return;
      }

      currentSettings = { ...currentSettings, ...settings };

      // Apply custom particle colors if configured — validate each value
      if (settings.customParticleColors && typeof settings.customParticleColors === 'object') {
        for (const [particle, color] of Object.entries(settings.customParticleColors)) {
          if (particle in PARTICLE_COLORS && typeof color === 'string' && VALID_COLOR.test(color)) {
            PARTICLE_COLORS[particle] = color;
          }
        }
      }
    });
  }

  // ── Create overlay element ─────────────────────────────────────────────
  function createOverlay(referenceElement) {
    if (overlayElement) return overlayElement;

    overlayElement = document.createElement('div');
    overlayElement.id = 'propersubs-overlay';
    overlayElement.className = 'propersubs-overlay';

    // Position relative to the reference subtitle element
    const parent = referenceElement.parentElement || document.body;
    parent.appendChild(overlayElement);

    return overlayElement;
  }

  // ── Apply particle coloring ────────────────────────────────────────────
  function colorizeParticles(text) {
    if (!currentSettings.particleColors) {
      return escapeHtml(text);
    }

    // Split text into words and process each
    return escapeHtml(text).replace(PARTICLE_REGEX, (match) => {
      const lower = match.toLowerCase();
      const color = PARTICLE_COLORS[lower] || '#999';
      return `<span class="propersubs-particle" style="color:${color};font-weight:700">${match}</span>`;
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Render subtitle ────────────────────────────────────────────────────
  function render(subtitleElement, structuredText, originalText) {
    if (!subtitleElement) return;

    const mode = currentSettings.displayMode;

    if (mode === 'replace') {
      renderReplace(subtitleElement, structuredText);
    } else if (mode === 'dual') {
      renderDual(subtitleElement, structuredText, originalText);
    } else if (mode === 'overlay') {
      renderOverlay(subtitleElement, structuredText, originalText);
    }
  }

  // Replace mode: swap subtitle text in-place
  function renderReplace(element, structuredText) {
    if (structuredText === INAUDIBLE) {
      element.innerHTML = `<span class="propersubs-line propersubs-inaudible">${escapeHtml(INAUDIBLE)}</span>`;
    } else {
      const html = colorizeParticles(structuredText);
      element.innerHTML = `<span class="propersubs-line">${html}</span>`;
    }
    applyStyles(element);
  }

  // Dual mode: show original Japanese + structured English stacked
  function renderDual(element, structuredText, originalText) {
    const structuredHtml = structuredText === INAUDIBLE
      ? `<span class="propersubs-inaudible">${escapeHtml(INAUDIBLE)}</span>`
      : colorizeParticles(structuredText);

    element.innerHTML =
      `<div class="propersubs-dual">` +
        `<div class="propersubs-original">${escapeHtml(originalText)}</div>` +
        `<div class="propersubs-structured">${structuredHtml}</div>` +
      `</div>`;
    applyStyles(element);
  }

  // Overlay mode: keep original, add structured as overlay below
  function renderOverlay(element, structuredText, originalText) {
    const overlay = createOverlay(element);
    const html = structuredText === INAUDIBLE
      ? `<span class="propersubs-inaudible">${escapeHtml(INAUDIBLE)}</span>`
      : colorizeParticles(structuredText);
    overlay.innerHTML = `<span class="propersubs-line">${html}</span>`;
    applyOverlayStyles(overlay, element);
  }

  // ── Apply inline styles based on settings ──────────────────────────────
  function applyStyles(element) {
    const s = currentSettings;
    if (s.fontSize !== 100) {
      element.style.fontSize = `${s.fontSize}%`;
    }
    if (s.opacity !== 100) {
      element.style.opacity = s.opacity / 100;
    }
  }

  function applyOverlayStyles(overlay, referenceElement) {
    const s = currentSettings;
    const rect = referenceElement.getBoundingClientRect();

    overlay.style.position = 'fixed';
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.top = `${rect.bottom + 4 + s.positionOffset}px`;
    overlay.style.fontSize = `${s.fontSize}%`;
    overlay.style.opacity = s.opacity / 100;
  }

  // ── Clear ──────────────────────────────────────────────────────────────
  function clear() {
    if (overlayElement) {
      overlayElement.remove();
      overlayElement = null;
    }
  }

  // ── Initialize ─────────────────────────────────────────────────────────
  loadSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') loadSettings();
  });

  return { render, clear, colorizeParticles };
})();
