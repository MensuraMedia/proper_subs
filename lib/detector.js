/**
 * ProperSubs — Media Detection Module
 *
 * Detects the presence and state of video, audio, subtitles,
 * and conversion capabilities on the current page.
 * Reports a structured status object to the popup via messaging.
 *
 * Detection categories:
 *   videoPage    — Is there a <video> element on this page?
 *   videoStream  — Is the video actively streaming / has a src?
 *   audioStream  — Does the video have an audio track?
 *   subtitleStream — Are external subtitles detected (DOM or textTracks)?
 *   audioConversion — Is audio-to-subtitle conversion available? (future feature)
 *
 * Subtitle type detection (when subtitles found):
 *   'dom-overlay'  — Custom positioned DIVs (Aniwave, FastStream, etc.)
 *   'text-track'   — Native <track> / textTracks API
 *   'embedded'     — Cannot be detected (hardcoded into video frames)
 */

'use strict';

const ProperSubsDetector = (() => {
  // Known subtitle DOM selectors (mirrors content.js / site-detect.js)
  const SUBTITLE_SELECTORS = [
    '.jw-text-track-container',
    '.jw-captions',
    '.subtitle-container',
    '.caption',
    '.subtitle-line',
    '.subtitles',
    '[class*="subtitle"]',
    '[class*="caption"]',
    '.vimond-text-track-display',
    '[data-testid="vimond-subtitle"]',
    '.player-timedtext',
    '.player-timedtext-text-container',
    '.rmp-content-subtitle'
  ];

  /**
   * Run full detection and return a status object.
   * @param {string} [customSelectors] - User-configured CSS selectors (comma-separated)
   * @returns {object} Detection status
   */
  function detect(customSelectors) {
    const result = {
      videoPage: false,
      videoStream: false,
      audioStream: false,
      subtitleStream: false,
      audioConversion: false,  // Future feature — always false for now
      subtitleType: null,      // 'dom-overlay' | 'text-track' | null
      subtitleSelector: null,  // Which selector matched
      videoInfo: null,         // { width, height, duration, currentTime, src }
      trackInfo: null,         // { count, languages, activeLabel }
    };

    // ── Video detection ──
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      result.videoPage = true;

      // Find the primary (largest or first playing) video
      let primary = null;
      for (const v of videos) {
        if (!primary || (!primary.paused && v.paused)) {
          primary = v;
        }
        // Prefer the one that's playing
        if (!v.paused) {
          primary = v;
          break;
        }
      }
      if (!primary) primary = videos[0];

      // Video stream check — has a source?
      const hasSrc = !!(primary.src || primary.querySelector('source')?.src || primary.currentSrc);
      const hasData = primary.readyState >= 1; // HAVE_METADATA or better
      result.videoStream = hasSrc || hasData;

      // Video info
      if (result.videoStream) {
        result.videoInfo = {
          width: primary.videoWidth || 0,
          height: primary.videoHeight || 0,
          duration: primary.duration || 0,
          currentTime: primary.currentTime || 0,
          src: (primary.currentSrc || primary.src || '').slice(0, 100),
          paused: primary.paused,
          readyState: primary.readyState
        };
      }

      // ── Audio detection ──
      // If video has loaded metadata and has audio tracks
      if (primary.audioTracks && primary.audioTracks.length > 0) {
        result.audioStream = true;
      } else if (hasData && !primary.muted) {
        // Fallback: if video has metadata and isn't explicitly muted,
        // assume audio is present (audioTracks API not widely supported)
        result.audioStream = true;
      } else if (hasSrc) {
        // If there's a source, assume audio exists (most video has audio)
        result.audioStream = true;
      }

      // ── Text track detection (native <track>) ──
      if (primary.textTracks && primary.textTracks.length > 0) {
        result.subtitleStream = true;
        result.subtitleType = 'text-track';

        const tracks = [];
        let activeLabel = null;
        for (let i = 0; i < primary.textTracks.length; i++) {
          const tt = primary.textTracks[i];
          tracks.push({
            label: tt.label || `Track ${i + 1}`,
            language: tt.language || 'unknown',
            kind: tt.kind,
            mode: tt.mode
          });
          if (tt.mode === 'showing') {
            activeLabel = tt.label || tt.language || `Track ${i + 1}`;
          }
        }

        result.trackInfo = {
          count: tracks.length,
          tracks: tracks,
          activeLabel: activeLabel
        };
      }
    }

    // ── DOM subtitle detection ──
    // Check even if textTracks found — DOM overlays take priority
    const selectors = [...SUBTITLE_SELECTORS];
    if (customSelectors) {
      selectors.unshift(...customSelectors.split(',').map(s => s.trim()).filter(Boolean));
    }

    for (const selector of selectors) {
      if (selector.startsWith('::')) continue;
      try {
        const el = document.querySelector(selector);
        if (el) {
          result.subtitleStream = true;
          result.subtitleType = 'dom-overlay';
          result.subtitleSelector = selector;
          break;
        }
      } catch (e) {
        // Invalid selector
      }
    }

    // ── Audio conversion (future feature placeholder) ──
    // This will be set to true when the audio-to-subtitle engine is implemented.
    // Detection capability is present but the feature is not yet built.
    result.audioConversion = false;

    return result;
  }

  return { detect };
})();
