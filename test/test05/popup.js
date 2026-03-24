// Load last test results from storage and display in popup
chrome.storage.local.get('lastTestResult', function(data) {
  var r = data.lastTestResult;
  var el = document.getElementById('results');
  if (!r) {
    el.textContent = 'No tests run yet';
    return;
  }

  var status = r.fail === 0 ? 'pass' : 'fail';
  var icon = r.fail === 0 ? '\u2714' : '\u2718';
  var time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '';

  el.innerHTML =
    '<div class="result-icon ' + status + '">' + icon + '</div>' +
    '<div class="result-counts">' +
      '<span class="rpass">' + r.pass + '</span> passed' +
      (r.fail > 0 ? '  <span class="rfail">' + r.fail + '</span> failed' : '') +
      (r.warn > 0 ? '  <span class="rwarn">' + r.warn + '</span> warn' : '') +
    '</div>' +
    '<div class="result-meta">' + r.elapsed + 'ms &middot; ' + time + '</div>';
});

document.getElementById('open').addEventListener('click', function() {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
