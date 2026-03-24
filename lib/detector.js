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
  // Get selectors from ProperSubsSiteDetect if available, otherwise use generic fallbacks
  const SUBTITLE_SELECTORS = typeof ProperSubsSiteDetect !== 'undefined'
    ? ProperSubsSiteDetect.getAllSelectors()
    : ['[class*="subtitle"]', '[class*="caption"]'];

  let registeredCapabilities = {
    audioConversion: false,
    audioConversionEngine: null
  };

  function registerCapability(name, engine) {
    if (name in registeredCapabilities) {
      registeredCapabilities[name] = true;
      if (engine) registeredCapabilities[name + 'Engine'] = engine;
    }
  }

  /**
   * Score video elements to find the primary (content) video,
   * accounting for ads, thumbnails, and multiple video elements.
   */
  function scorePrimaryVideo(videos) {
    let best = null;
    let bestScore = -1;
    for (const v of videos) {
      let score = 0;
      if (!v.paused && !v.ended) score += 100;
      const area = (v.videoWidth || v.clientWidth || 0) * (v.videoHeight || v.clientHeight || 0);
      score += Math.min(area / 1000, 50);
      if (v.duration > 60) score += 30;
      else if (v.duration > 10) score += 10;
      if (v.offsetParent !== null) score += 20;
      if (v.readyState >= 1) score += 10;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return best || videos[0];
  }

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
      audioConfidence: 'none',
      subtitleStream: false,
      audioConversion: false,
      subtitleType: null,      // 'dom-overlay' | 'text-track' | null
      subtitleSelector: null,  // Which selector matched
      subtitleSiteName: null,  // Site name from ProperSubsSiteDetect
      videoInfo: null,         // { width, height, duration, currentTime, src }
      trackInfo: null,         // { count, languages, activeLabel }
      audioConversionEngine: null,
    };

    // ── Video detection ──
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      result.videoPage = true;

      // Find the primary video using scoring heuristic
      const primary = scorePrimaryVideo([...videos]);

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

      // ── Audio detection — tiered confidence ──
      result.audioStream = false;
      result.audioConfidence = 'none';

      if (primary.audioTracks && primary.audioTracks.length > 0) {
        result.audioStream = true;
        result.audioConfidence = 'confirmed';
      } else if (hasData && primary.readyState >= 2) {
        if (!primary.muted || primary.volume > 0) {
          result.audioStream = true;
          result.audioConfidence = 'likely';
        }
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
          result.subtitleSelector = selector;

          const siteInfo = typeof ProperSubsSiteDetect !== 'undefined'
            ? ProperSubsSiteDetect.identifySelector(selector)
            : null;
          if (siteInfo) {
            result.subtitleType = siteInfo.playerType;
            result.subtitleSiteName = siteInfo.siteName;
          } else {
            result.subtitleType = 'dom-overlay';
          }

          break;
        }
      } catch (e) {
        // Invalid selector
      }
    }

    // ── Capability registration ──
    result.audioConversion = registeredCapabilities.audioConversion;
    result.audioConversionEngine = registeredCapabilities.audioConversionEngine || null;

    return result;
  }

  return { detect, registerCapability };
})();
