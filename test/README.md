# Proper Subs — Test Suite

Tests 01-06 are standalone Chrome extensions loaded via `chrome://extensions` in Developer Mode.
Test 07 is different — it runs as a regular web page via HTTP to test the main extension's content script injection.

## Test Index

| Test | Folder | Type | What It Tests |
|------|--------|------|---------------|
| **01** | `test01/` | Extension | Manifest structure, MV3 compliance, permissions, file references |
| **02** | `test02/` | Extension | Subtitle DOM capture across 5 site patterns, MutationObserver, detection system |
| **03** | `test03/` | Extension | LLM pipeline — all 4 providers, latency, particle validation |
| **04** | `test04/` | Extension | Display renderer, particle coloring, passthrough overlay, XSS prevention |
| **05** | `test05/` | Extension | Storage isolation — API key in local, preferences in sync, session cache |
| **06** | `test06/` | Extension | Timeout/[inaudible] fallback, AbortController, all 4 providers |
| **07** | `test07/` | **HTTP page** | **Live end-to-end: real video + WebVTT subtitles + extension capture proof** |

## How to Run Tests 01-06

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `test/testNN/` folder
4. Click the extension icon — popup shows last test results
5. Click **Run Tests** to open the full test page

## How to Run Test 07 (End-to-End)

Test 07 proves the full pipeline works on a real page with a real video:

```bash
cd test/test07
./serve.sh
```

Then open `http://localhost:8080` in Chrome **with the main Proper Subs extension installed**.

What to verify:
1. The page's self-detection panel shows checkmarks for video, source, tracks, DOM container
2. Click the **Proper Subs extension icon** — the popup should show checkmarks for Video Page, Video Stream, Audio Stream, Subtitle Stream
3. Click **play** on the video — Japanese subtitle cues appear in the DOM overlay
4. The extension's **passthrough overlay** (yellow text on dark gray) should appear on the video frame
5. If an API key is configured, the structured English transformation also appears

## Requirements

- Tests 01, 02, 04, 05, 07: No API key needed
- Tests 03, 06: Require an LLM API key for live provider tests
- Test 07: Requires the main Proper Subs extension installed + HTTP server
