/**
 * ProperSubs — Shared Test Harness
 *
 * Provides pass/fail/warn/info reporting for all test pages.
 * Each test page creates a TestRunner and calls runner.assert() / runner.log().
 */

class TestRunner {
  constructor(containerId = 'results') {
    this.container = document.getElementById(containerId);
    this.counts = { pass: 0, fail: 0, warn: 0, info: 0 };
    this.startTime = performance.now();
  }

  _addResult(type, label, detail = '') {
    const icons = { pass: '\u2714', fail: '\u2718', warn: '\u26A0', info: '\u2139' };
    this.counts[type]++;

    const row = document.createElement('div');
    row.className = `result ${type}`;
    row.innerHTML =
      `<span class="icon">${icons[type]}</span>` +
      `<span class="label">${this._esc(label)}</span>` +
      (detail ? `<span class="detail">${this._esc(String(detail))}</span>` : '');
    this.container.appendChild(row);
    return this;
  }

  pass(label, detail) { return this._addResult('pass', label, detail); }
  fail(label, detail) { return this._addResult('fail', label, detail); }
  warn(label, detail) { return this._addResult('warn', label, detail); }
  info(label, detail) { return this._addResult('info', label, detail); }

  assert(condition, label, detail) {
    return condition ? this.pass(label, detail) : this.fail(label, detail);
  }

  assertThrows(fn, label) {
    try {
      fn();
      return this.fail(label, 'No exception thrown');
    } catch (e) {
      return this.pass(label, e.message);
    }
  }

  async assertAsync(promiseFn, label) {
    try {
      const result = await promiseFn();
      return this.pass(label, result);
    } catch (e) {
      return this.fail(label, e.message);
    }
  }

  summary() {
    const elapsed = (performance.now() - this.startTime).toFixed(0);
    const el = document.createElement('div');
    el.className = 'summary';
    el.innerHTML =
      `<div><span class="count pass-count">${this.counts.pass}</span> passed</div>` +
      `<div><span class="count fail-count">${this.counts.fail}</span> failed</div>` +
      (this.counts.warn ? `<div><span class="count warn-count">${this.counts.warn}</span> warnings</div>` : '') +
      `<div style="color:#666">${elapsed}ms</div>`;
    this.container.parentElement.appendChild(el);

    // Set page title to reflect outcome
    const total = this.counts.pass + this.counts.fail;
    document.title = `${this.counts.fail === 0 ? '\u2714' : '\u2718'} ${this.counts.pass}/${total} — ${document.title}`;

    // Persist results to storage so popup can display them
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        lastTestResult: {
          pass: this.counts.pass,
          fail: this.counts.fail,
          warn: this.counts.warn,
          total: total,
          elapsed: elapsed,
          timestamp: new Date().toISOString()
        }
      });
    }

    return this;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
}

/**
 * Check if the ProperSubs extension is loaded in this browser.
 */
function isExtensionAvailable() {
  return typeof chrome !== 'undefined' &&
         typeof chrome.runtime !== 'undefined' &&
         typeof chrome.runtime.sendMessage === 'function';
}

/**
 * Append to a log area element.
 */
function appendLog(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent += `[${new Date().toISOString().slice(11, 23)}] ${text}\n`;
    el.scrollTop = el.scrollHeight;
  }
}
