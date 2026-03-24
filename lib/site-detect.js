/**
 * ProperSubs — Site Detection
 *
 * Auto-detects streaming sites and returns site-specific
 * configuration (subtitle selectors, player type, etc.).
 */

'use strict';

const ProperSubsSiteDetect = (() => {
  const SITES = [
    {
      name: 'Aniwave',
      patterns: [/aniwave/i, /9anime/i, /anix/i, /aniwatch/i],
      selectors: ['.jw-text-track-container', '.jw-captions', '.subtitle-container'],
      playerType: 'jwplayer'
    },
    {
      name: 'FastStream',
      patterns: [/faststream/i, /rapidstream/i, /megacloud/i, /vidcloud/i],
      selectors: ['.subtitle-container', '.caption', '[class*="subtitle"]'],
      playerType: 'faststream'
    },
    {
      name: 'Crunchyroll',
      patterns: [/crunchyroll\.com/i],
      selectors: ['.vimond-text-track-display', '[data-testid="vimond-subtitle"]'],
      playerType: 'vimond'
    },
    {
      name: 'Netflix',
      patterns: [/netflix\.com/i],
      selectors: ['.player-timedtext', '.player-timedtext-text-container'],
      playerType: 'cadmium'
    },
    {
      name: 'HIDIVE',
      patterns: [/hidive\.com/i],
      selectors: ['.subtitle-container', '.rmp-content-subtitle'],
      playerType: 'radiant'
    },
    {
      name: 'Gogoanime',
      patterns: [/gogoanime/i, /gogoplay/i, /anitaku/i],
      selectors: ['.jw-text-track-container', '.jw-captions'],
      playerType: 'jwplayer'
    },
    {
      name: 'Zoro',
      patterns: [/zoro\.to/i, /kaido\.to/i, /hianime/i],
      selectors: ['.jw-text-track-container', '.subtitle-container'],
      playerType: 'custom'
    }
  ];

  function detect() {
    const href = window.location.href;
    const hostname = window.location.hostname;

    for (const site of SITES) {
      for (const pattern of site.patterns) {
        if (pattern.test(href) || pattern.test(hostname)) {
          return {
            name: site.name,
            selectors: site.selectors,
            playerType: site.playerType
          };
        }
      }
    }

    // Check for embedded iframes (Aniwave uses iframes for the player)
    if (window.self !== window.top) {
      // We're inside an iframe — check for player-specific elements
      if (document.querySelector('.jw-video')) {
        return { name: 'JWPlayer (iframe)', selectors: ['.jw-text-track-container', '.jw-captions'], playerType: 'jwplayer' };
      }
      if (document.querySelector('[class*="faststream"]')) {
        return { name: 'FastStream (iframe)', selectors: ['.subtitle-container', '.caption'], playerType: 'faststream' };
      }
    }

    return null; // Unknown site
  }

  function getSiteSelectors() {
    const site = detect();
    return site ? site.selectors : [];
  }

  function getAllSelectors() {
    const all = new Set();
    for (const site of SITES) {
      site.selectors.forEach(s => all.add(s));
    }
    // Add generic fallbacks
    all.add('[class*="subtitle"]');
    all.add('[class*="caption"]');
    return [...all];
  }

  function identifySelector(selector) {
    for (const site of SITES) {
      if (site.selectors.includes(selector)) {
        return { siteName: site.name, playerType: site.playerType };
      }
    }
    return null;
  }

  return { detect, getSiteSelectors, getAllSelectors, identifySelector, SITES };
})();
