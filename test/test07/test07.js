// Test 07 — Live End-to-End Subtitle Capture
// This page is served via HTTP so the main extension's content script injects.
// It has a real <video> + WebVTT track + DOM overlay subtitle container.

(function() {
  var video = document.getElementById('video');
  var subLine = document.getElementById('sub-line');
  var logEl = document.getElementById('log');

  function log(msg) {
    var ts = new Date().toISOString().slice(11, 23);
    logEl.textContent += '[' + ts + '] ' + msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setCheck(id, on, detail) {
    var chk = document.getElementById('chk-' + id);
    var lbl = document.getElementById('lbl-' + id);
    var det = document.getElementById('det-' + id);
    if (on) {
      chk.classList.add('on');
      lbl.classList.add('on');
      det.classList.add('on');
    }
    if (detail) det.textContent = detail;
  }

  // ── Video element detection ──
  if (video) {
    setCheck('video', true, 'found');
    log('Video element found');
  } else {
    log('ERROR: No video element');
  }

  // ── Source detection ──
  video.addEventListener('loadedmetadata', function() {
    var w = video.videoWidth;
    var h = video.videoHeight;
    setCheck('src', true, w + 'x' + h);
    log('Video metadata loaded: ' + w + 'x' + h + ', duration=' + video.duration.toFixed(1) + 's');
  });

  if (video.src || video.querySelector('source')) {
    var src = video.currentSrc || video.querySelector('source').src || '';
    log('Video source: ' + src.slice(0, 60));
  }

  // ── Text track detection ──
  if (video.textTracks && video.textTracks.length > 0) {
    var trackCount = video.textTracks.length;
    setCheck('tracks', true, trackCount + ' track(s)');
    log('Text tracks found: ' + trackCount);

    for (var i = 0; i < video.textTracks.length; i++) {
      var tt = video.textTracks[i];
      log('  Track ' + i + ': ' + tt.label + ' (' + tt.language + ') kind=' + tt.kind + ' mode=' + tt.mode);

      // Ensure track is showing for cuechange events
      if (tt.mode === 'disabled') tt.mode = 'hidden';
    }
  } else {
    log('No text tracks found');
  }

  // ── DOM subtitle container ──
  var subContainer = document.querySelector('.subtitle-container');
  if (subContainer) {
    setCheck('dom', true, '.subtitle-container');
    log('DOM subtitle container found');
  }

  // ── Drive the DOM overlay from the text track cues ──
  // This simulates what a real streaming site does: update a DOM element
  // with each subtitle cue, which the extension's MutationObserver captures.
  var cueCount = 0;
  if (video.textTracks.length > 0) {
    var track = video.textTracks[0];
    track.mode = 'hidden'; // Hide native rendering, we use DOM overlay

    track.addEventListener('cuechange', function() {
      var cue = track.activeCues && track.activeCues[0];
      if (cue) {
        cueCount++;
        subLine.textContent = cue.text;
        log('Cue ' + cueCount + ': "' + cue.text + '"');
        setCheck('capture', true, cueCount + ' cues');
      } else {
        subLine.textContent = '';
      }
    });
  }

  // ── Extension detection ──
  // Check if the main Proper Subs extension's content script is running
  // by looking for the globals it creates
  setTimeout(function() {
    var hasExtension = typeof ProperSubsSiteDetect !== 'undefined' ||
                       typeof ProperSubsDetector !== 'undefined' ||
                       typeof ProperSubsDisplay !== 'undefined';

    if (hasExtension) {
      setCheck('ext', true, 'content script loaded');
      log('Proper Subs extension detected on this page');
    } else {
      setCheck('ext', false, 'not detected');
      log('Proper Subs extension NOT detected — is it installed? Is this page served via HTTP?');
    }

    // Check for the passthrough overlay element
    var passthrough = document.getElementById('propersubs-passthrough');
    if (passthrough) {
      log('Passthrough overlay element found');
    }
  }, 2000);

  // ── Periodic check for extension overlay ──
  var overlayCheckInterval = setInterval(function() {
    var passthrough = document.getElementById('propersubs-passthrough');
    if (passthrough && passthrough.textContent) {
      log('Extension passthrough overlay active: "' + passthrough.textContent + '"');
      clearInterval(overlayCheckInterval);
    }
  }, 1000);

  // Stop checking after 60s
  setTimeout(function() { clearInterval(overlayCheckInterval); }, 60000);

  log('Test 07 initialized — click play to start subtitle cue simulation');
})();
