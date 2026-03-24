# Proper Subs — Test Suite

Each test is a standalone Chrome extension that can be loaded independently via `chrome://extensions` in Developer Mode.

## Test Index

| Test | Folder | What It Tests |
|------|--------|---------------|
| **01** | `test01/` | Manifest structure, MV3 compliance, permissions minimality, file references |
| **02** | `test02/` | Subtitle DOM capture across 5 streaming site patterns (Aniwave, FastStream, Crunchyroll, Netflix, HIDIVE), MutationObserver, Japanese detection |
| **03** | `test03/` | LLM transformation pipeline — all 4 providers (Groq, OpenAI, Claude, Gemini), latency measurement, particle validation |
| **04** | `test04/` | Display renderer, particle color-coding, dual mode, XSS prevention, custom color validation |
| **05** | `test05/` | Storage isolation — API key in local (not synced), preferences in sync, session storage for cache |
| **06** | `test06/` | Timeout fallback, AbortController, `[inaudible]` behavior, invalid API keys, response validation |

## How to Run

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select any `test/testNN/` folder
5. Click the extension icon to open the test
6. Tests 02-06 open in a full tab (click the button in the popup)

You can load multiple tests simultaneously — each has its own manifest.

## Requirements

- Tests 01, 02, 04, 05: No API key needed
- Tests 03, 06: Require an LLM API key for live provider tests (offline tests run without)
