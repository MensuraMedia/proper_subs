const EXPECTED_FILES = [
  'background.js', 'content.js',
  'lib/site-detect.js', 'lib/detector.js', 'lib/display.js',
  'styles/subtitle-overlay.css',
  'popup/popup.html', 'options/options.html',
  'icons/icon-16.png', 'icons/icon-48.png', 'icons/icon-128.png'
];

document.getElementById('btn-run').addEventListener('click', async () => {
  const t = new TestRunner();

  // Load the main extension's manifest (bundled copy)
  let manifest;
  try {
    const res = await fetch('target-manifest.json');
    manifest = await res.json();
    t.pass('manifest.json loaded and parsed');
  } catch (e) {
    t.fail('Failed to load target-manifest.json', e.message);
    t.summary();
    return;
  }

  // ── Structure ──
  t.assert(manifest.manifest_version === 3, 'Manifest V3', `v${manifest.manifest_version}`);
  t.assert(!!manifest.name, 'Has name', manifest.name);
  t.assert(!!manifest.version, 'Has version', manifest.version);
  t.assert(!!manifest.description, 'Has description', manifest.description?.slice(0, 50) + '...');

  // ── Background ──
  t.assert(manifest.background?.service_worker, 'Background service worker declared', manifest.background?.service_worker);
  t.assert(manifest.background?.type === 'module', 'Background uses ES modules');

  // ── Content scripts ──
  const cs = manifest.content_scripts?.[0];
  t.assert(cs, 'Content scripts block exists');
  t.assert(cs?.js?.includes('content.js'), 'Includes content.js');
  t.assert(cs?.js?.includes('lib/display.js'), 'Includes lib/display.js');
  t.assert(cs?.js?.includes('lib/site-detect.js'), 'Includes lib/site-detect.js');
  t.assert(cs?.css?.includes('styles/subtitle-overlay.css'), 'Includes overlay CSS');

  // ── Permissions ──
  const perms = manifest.permissions || [];
  t.assert(perms.includes('storage'), 'Has storage permission');
  t.assert(!perms.includes('scripting'), 'No unused scripting');
  t.assert(!perms.includes('activeTab'), 'No unused activeTab');
  t.assert(!perms.includes('tabs'), 'No unused tabs');
  t.assert(perms.length === 1, 'Exactly 1 permission', perms.join(', '));

  // ── Host permissions ──
  const hosts = manifest.host_permissions || [];
  t.assert(!hosts.includes('<all_urls>'), 'No <all_urls> in host_permissions');
  t.assert(hosts.length >= 4, `${hosts.length} host permissions`);

  const domains = ['api.groq.com', 'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com'];
  for (const d of domains) {
    t.assert(hosts.some(h => h.includes(d)), `Host: ${d}`);
  }

  // ── Popup & Options ──
  t.assert(manifest.action?.default_popup, 'Popup declared', manifest.action?.default_popup);
  t.assert(manifest.options_ui?.page, 'Options page declared', manifest.options_ui?.page);
  t.assert(manifest.options_ui?.open_in_tab === true, 'Options opens in tab');

  // ── Icons ──
  const icons = manifest.icons || {};
  t.assert(icons['16'], 'Icon 16px');
  t.assert(icons['48'], 'Icon 48px');
  t.assert(icons['128'], 'Icon 128px');

  // ── All expected files referenced ──
  const allRefs = [
    ...(cs?.js || []), ...(cs?.css || []),
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...Object.values(icons)
  ].filter(Boolean);

  for (const f of EXPECTED_FILES) {
    t.assert(allRefs.includes(f), `References ${f}`);
  }

  // ── Security ──
  const raw = JSON.stringify(manifest);
  t.assert(!raw.includes('unsafe-eval'), 'No unsafe-eval');
  t.assert(!raw.includes('unsafe-inline'), 'No unsafe-inline');

  t.summary();
});
