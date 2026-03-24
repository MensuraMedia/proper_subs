const JP_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

const TEST_CUES = [
  '私はリンゴを食べます。',
  '彼女が学校に走って行きました',
  '明日から東京で働きます',
  '友達と映画を見に行った',
  'この本はとても面白いです',
];

// Site selector mappings (mirrors lib/site-detect.js)
const SITE_TESTS = [
  {
    name: 'Aniwave / JWPlayer',
    containerId: 'sim-aniwave',
    selector: '.jw-text-track-cue',
    updateMethod: 'textContent'
  },
  {
    name: 'FastStream',
    containerId: 'sim-faststream',
    selector: '.subtitle-line',
    updateMethod: 'innerHTML'
  },
  {
    name: 'Crunchyroll / Vimond',
    containerId: 'sim-crunchyroll',
    selector: '.vimond-text-track-display',
    updateMethod: 'textContent'
  },
  {
    name: 'Netflix / Cadmium',
    containerId: 'sim-netflix',
    selector: '.player-timedtext-text-container span',
    updateMethod: 'innerHTML'
  },
  {
    name: 'HIDIVE / Radiant',
    containerId: 'sim-hidive',
    selector: '.rmp-content-subtitle',
    updateMethod: 'textContent'
  }
];

document.getElementById('btn-run').addEventListener('click', async () => {
  const t = new TestRunner();
  const log = msg => appendLog('log', msg);

  // ── Japanese detection ──
  log('--- Japanese Detection ---');
  const jpTests = [
    ['私はテスト', true], ['Hello world', false], ['カタカナ', true],
    ['123', false], ['Mixed 世界', true], ['', false], ['   ', false]
  ];
  for (const [text, expected] of jpTests) {
    const result = JP_REGEX.test(text);
    t.assert(result === expected, `JP detect: "${text || '(empty)'}"`, `${result}`);
  }

  // ── Per-site capture tests ──
  for (const site of SITE_TESTS) {
    log(`\n--- ${site.name} ---`);
    const container = document.getElementById(site.containerId);
    const subEl = container.querySelector(site.selector);

    if (!subEl) {
      t.fail(`${site.name}: subtitle element not found`, site.selector);
      continue;
    }
    t.pass(`${site.name}: element found`, site.selector);

    // Set up observer
    const captured = [];
    const obs = new MutationObserver(() => {
      const text = subEl.textContent.trim();
      if (text && !captured.includes(text)) captured.push(text);
    });
    obs.observe(subEl, { childList: true, characterData: true, subtree: true });

    // Simulate cue sequence
    for (const cue of TEST_CUES) {
      await new Promise(r => setTimeout(r, 120));
      if (site.updateMethod === 'innerHTML') {
        subEl.innerHTML = `<span>${cue}</span>`;
      } else {
        subEl.textContent = cue;
      }
      log(`  Set (${site.updateMethod}): "${cue}"`);
    }

    await new Promise(r => setTimeout(r, 200));
    obs.disconnect();

    t.assert(captured.length === TEST_CUES.length,
      `${site.name}: captured ${captured.length}/${TEST_CUES.length} cues`,
      captured.length < TEST_CUES.length ? `missed ${TEST_CUES.length - captured.length}` : 'all captured'
    );

    // Verify all captured text is Japanese
    const allJP = captured.every(c => JP_REGEX.test(c));
    t.assert(allJP, `${site.name}: all captured cues are Japanese`);

    log(`  Captured: ${captured.length} cues`);
  }

  // ── Deduplication test ──
  log('\n--- Deduplication ---');
  const dedupeEl = document.querySelector('.jw-text-track-cue');
  const dupes = [];
  const dupeObs = new MutationObserver(() => {
    const text = dedupeEl.textContent.trim();
    if (text) dupes.push(text);
  });
  dupeObs.observe(dedupeEl, { childList: true, characterData: true, subtree: true });

  // Set same text twice
  dedupeEl.textContent = '同じテキスト';
  await new Promise(r => setTimeout(r, 100));
  dedupeEl.textContent = '同じテキスト';
  await new Promise(r => setTimeout(r, 100));
  dedupeEl.textContent = '違うテキスト';
  await new Promise(r => setTimeout(r, 200));
  dupeObs.disconnect();

  t.info(`Dedup: observer fired ${dupes.length} times for 3 textContent sets`, 'Extension should filter dupes');

  // ── Empty/whitespace handling ──
  log('\n--- Edge Cases ---');
  t.assert(!JP_REGEX.test(''), 'Empty string not detected as JP');
  t.assert(!JP_REGEX.test('   '), 'Whitespace not detected as JP');
  t.assert(!JP_REGEX.test('12345'), 'Numbers not detected as JP');
  t.assert(JP_REGEX.test('あ'), 'Single hiragana detected');
  t.assert(JP_REGEX.test('ア'), 'Single katakana detected');
  t.assert(JP_REGEX.test('漢'), 'Single kanji detected');

  // ── Detection system tests ──
  log('\n--- Detection System ---');

  // Video detection on this page (has simulated players but no real <video>)
  const videos = document.querySelectorAll('video');
  t.assert(videos.length === 0, 'No real <video> on test page', `${videos.length} found`);

  // DOM subtitle selectors — should find our simulated elements
  const subtitleSelectors = [
    '.jw-captions', '.subtitle-container', '.vimond-text-track-display',
    '.player-timedtext', '.rmp-content-subtitle'
  ];
  for (const sel of subtitleSelectors) {
    const el = document.querySelector(sel);
    t.assert(!!el, `Selector finds element: ${sel}`);
  }

  // Simulate a video element for detection testing
  log('\n--- Video Element Detection ---');
  const fakeVideo = document.createElement('video');
  fakeVideo.setAttribute('src', 'https://example.com/test.m3u8');
  fakeVideo.style.display = 'none';
  document.body.appendChild(fakeVideo);

  const videoCheck = document.querySelectorAll('video');
  t.assert(videoCheck.length > 0, 'Injected <video> detected', `${videoCheck.length}`);

  const hasSrc = !!(fakeVideo.src || fakeVideo.currentSrc);
  t.assert(hasSrc, 'Video has src attribute', fakeVideo.src?.slice(0, 40));

  // Clean up
  fakeVideo.remove();

  t.summary();
});
