'use strict';

const $ = id => document.getElementById(id);

// ── Detection UI helpers ─────────────────────────────────────────────────
function setDetect(id, on, detail) {
  const chk = $(`chk-${id}`);
  const lbl = $(`lbl-${id}`);
  const det = $(`det-${id}`);

  if (on) {
    chk.classList.add('on');
    lbl.classList.add('on');
    if (det) {
      det.classList.add('on');
      if (detail) det.textContent = detail;
    }
  } else {
    chk.classList.remove('on');
    lbl.classList.remove('on');
    if (det) {
      det.classList.remove('on');
      if (detail) det.textContent = detail;
    }
  }
}

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

// ── Query content script for detection status ────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (!tabs[0]) {
    setDetect('video', false, 'no tab');
    return;
  }

  chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }, response => {
    if (chrome.runtime.lastError || !response) {
      // Content script not loaded on this page
      setDetect('video', false, 'not active');
      setDetect('stream', false, '--');
      setDetect('audio', false, '--');
      setDetect('subs', false, '--');
      setDetect('convert', false, 'planned');
      return;
    }

    // Site badge
    if (response.site) {
      const badge = $('site-badge');
      badge.textContent = response.site.name;
      badge.style.display = 'inline-block';
    }

    // Detection results
    const d = response.detection;
    if (d) {
      // Video page
      setDetect('video', d.videoPage, d.videoPage ? 'found' : 'none');

      // Video stream
      if (d.videoStream && d.videoInfo) {
        const v = d.videoInfo;
        const res = v.width && v.height ? `${v.width}x${v.height}` : 'loading';
        setDetect('stream', true, res);
      } else {
        setDetect('stream', false, d.videoPage ? 'no source' : '--');
      }

      // Audio stream
      if (d.audioStream) {
        const confLabel = d.audioConfidence === 'confirmed' ? 'confirmed' : 'likely';
        setDetect('audio', true, confLabel);
      } else {
        setDetect('audio', false, d.videoPage ? 'not detected' : '--');
      }

      // Subtitle stream
      if (d.subtitleStream) {
        let detail;
        if (d.subtitleType === 'text-track') {
          detail = 'track (' + (d.trackInfo?.count || '?') + ')';
          if (d.trackInfo?.activeLabel) detail += ' [' + d.trackInfo.activeLabel + ']';
        } else if (d.subtitleType && d.subtitleType !== 'dom-overlay') {
          detail = d.subtitleSiteName ? d.subtitleSiteName + ' (' + d.subtitleType + ')' : d.subtitleType;
        } else {
          detail = 'DOM overlay';
        }
        setDetect('subs', true, detail);
      } else {
        setDetect('subs', false, d.videoPage ? 'not found' : '--');
      }

      // Audio conversion
      setDetect('convert', d.audioConversion, d.audioConversion ? (d.audioConversionEngine || 'active') : 'planned');
    }

    // Last cue
    if (response.lastCue) {
      $('last-cue').textContent = response.lastCue;
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
