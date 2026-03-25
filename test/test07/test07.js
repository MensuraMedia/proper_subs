// Test 07 — Live End-to-End Subtitle Capture
// Embeds a real video with WebVTT subtitles and drives a DOM overlay
// via cuechange events — proving the capture pipeline works.

(function() {
  var video = document.getElementById('video');
  var subLine = document.getElementById('sub-line');
  var logEl = document.getElementById('log');
  var cueCount = 0;

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

  // ── Video element ──
  if (video) {
    setCheck('video', true, 'found');
    log('Video element found');
  } else {
    log('ERROR: No video element');
    return;
  }

  // ── Source ──
  video.addEventListener('loadedmetadata', function() {
    var w = video.videoWidth;
    var h = video.videoHeight;
    setCheck('src', true, w + 'x' + h);
    log('Metadata loaded: ' + w + 'x' + h + ', duration=' + video.duration.toFixed(1) + 's');
  });

  video.addEventListener('error', function() {
    log('Video load error — this is expected if the external source is unavailable');
    setCheck('src', false, 'load error');
  });

  // ── Text tracks ──
  var trackCheck = setInterval(function() {
    if (video.textTracks && video.textTracks.length > 0) {
      clearInterval(trackCheck);
      var count = video.textTracks.length;
      setCheck('tracks', true, count + ' track(s)');
      log('Text tracks: ' + count);

      for (var i = 0; i < video.textTracks.length; i++) {
        var tt = video.textTracks[i];
        log('  Track ' + i + ': ' + (tt.label || 'unlabeled') + ' (' + (tt.language || '?') + ') mode=' + tt.mode);
      }

      setupCueDriver();
    }
  }, 200);

  setTimeout(function() {
    clearInterval(trackCheck);
    if (!video.textTracks || video.textTracks.length === 0) {
      log('No text tracks found after timeout');
      setCheck('tracks', false, 'none');
    }
  }, 5000);

  // ── DOM subtitle container ──
  var subContainer = document.querySelector('.subtitle-container');
  if (subContainer) {
    setCheck('dom', true, '.subtitle-container');
    log('DOM subtitle container ready');
  }

  // ── Drive DOM overlay from text track cues ──
  function setupCueDriver() {
    var track = video.textTracks[0];
    track.mode = 'hidden'; // Hide native rendering, we use DOM overlay

    track.addEventListener('cuechange', function() {
      var cue = track.activeCues && track.activeCues[0];
      if (cue) {
        cueCount++;
        subLine.textContent = cue.text;
        setCheck('capture', true, cueCount + ' cues');
        log('Cue ' + cueCount + ': "' + cue.text + '"');
      } else {
        subLine.textContent = '';
      }
    });

    log('Cue driver ready — click play to start');
  }

  // ── Also set up a MutationObserver to prove the pipeline ──
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var text = subLine.textContent.trim();
      if (text) {
        log('MutationObserver captured: "' + text + '"');
        break;
      }
    }
  });

  observer.observe(subLine, { childList: true, characterData: true, subtree: true });

  log('Test 07 ready — click play on the video');
})();
