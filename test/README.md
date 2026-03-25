# Proper Subs — Test Suite

Tests 01-06 are standalone Chrome extensions loaded via `chrome://extensions` in Developer Mode.
Test 07 loads the same way as the others but includes an embedded video with WebVTT subtitles.

## Test Index

| Test | Folder | Type | What It Tests |
|------|--------|------|---------------|
| **01** | `test01/` | Extension | Manifest structure, MV3 compliance, permissions, file references |
| **02** | `test02/` | Extension | Subtitle DOM capture across 5 site patterns, MutationObserver, detection system |
| **03** | `test03/` | Extension | LLM pipeline — all 4 providers, latency, particle validation |
| **04** | `test04/` | Extension | Display renderer, particle coloring, passthrough overlay, XSS prevention |
| **05** | `test05/` | Extension | Storage isolation — API key in local, preferences in sync, session cache |
| **06** | `test06/` | Extension | Timeout/[inaudible] fallback, AbortController, all 4 providers |
| **07** | `test07/` | Extension | Live end-to-end: real video + WebVTT subtitles + MutationObserver capture proof |

## How to Run Tests 01-06

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `test/testNN/` folder
4. Click the extension icon — popup shows last test results
5. Click **Run Tests** to open the full test page

## Requirements

- Tests 01, 02, 04, 05, 07: No API key needed
- Tests 03, 06: Require an LLM API key for live provider tests
