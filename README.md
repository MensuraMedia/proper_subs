# ProperSubs — Structured Japanese Subtitles for Anime Immersion

A free, open-source Chrome extension that transforms Japanese anime subtitles into **literal structured English** — preserving the exact Japanese word order with visible particles — so language learners can map spoken Japanese directly to meaning without mental reordering.

## The Problem

When watching anime with English subtitles, the sentence structure is completely rearranged to sound natural in English. This forces your brain to constantly reorder words, breaking the direct connection between what you hear and what you read.

**Standard subtitle:**
> I eat an apple every day.

**What you actually hear (Japanese order):**
> 私は (I wa) リンゴを (apple o) 毎日 (every day) 食べます (eat)

These don't match. Your brain has to do gymnastics to connect the audio to the text.

## The Solution

ProperSubs intercepts live subtitle cues and transforms them into structured English that mirrors the Japanese word order exactly:

```
Japanese:  私はリンゴを毎日食べます。
Standard:  I eat an apple every day.
ProperSubs: I wa apple o every day eat.
```

Now when you hear 「私は」 your eyes see "I wa" at the exact same moment. Perfect structural mapping during immersion listening.

### Rules the engine follows:

1. **Preserve the EXACT Japanese word order** — never naturalize or reorder
2. **Insert original Japanese particles** after corresponding English words (wa, ga, o, ni, de, kara, to, mo, no, etc.)
3. **Drop English words with no Japanese equivalent** (is/are/be, a/the, etc.)
4. **Keep punctuation, timing, and line breaks identical**
5. **Output ONLY the structured line** — nothing extra

## Features

### Core (v1.0)

- **Live subtitle capture** via MutationObserver on streaming site DOM elements
- **Real-time transformation** using LLM APIs (Groq, Claude, OpenAI, Gemini)
- **Bring your own API key** — configured in the options page
- **Dual display mode** — structured English only, or stacked with original Japanese
- **Color-coded particles** — wa/ga blue, o red, ni green (fully configurable)
- **Click-to-define** — click any word for instant Jisho/MassDict dictionary popup
- **Anki export** — one-click capture: structured text + timestamp + original Japanese
- **Offline fallback** — kuromoji.js tokenizer + JMdict dictionary (zero API cost)
- **Site auto-detection** — works on Aniwave mirrors, Crunchyroll, Netflix, HIDIVE, etc.
- **Debug mode** — logs every captured cue for troubleshooting

### Display Controls

- Font size, opacity, and position offset sliders
- Particle highlight toggle (bold/color/off)
- Auto-pause on new structured line
- Timing offset slider (±500 ms)
- Configurable CSS selectors for new/unknown streaming sites

### Future / Toggleable

- Export full episode as `.srt` with structured lines
- Voice-over TTS of structured English (browser SpeechSynthesis or ElevenLabs)
- Particle highlighter mode (bolds only particles as audio plays)
- Local vector DB for caching translations per show
- Community prompt sharing
- Desktop mpv / ASBPlayer export mode
- Interlinear gloss mode (word-by-word with furigana)

## How It Works

### Subtitle Capture Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    Streaming Site                             │
│  ┌─────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ HLS/.m3u8│───▶│ hls.js /     │───▶│ Custom subtitle DOM │ │
│  │ + .vtt   │    │ HTML5 <video>│    │ (.subtitle-container│ │
│  └─────────┘    └──────────────┘    │  .caption, etc.)    │ │
│                                      └────────┬────────────┘ │
└───────────────────────────────────────────────┼──────────────┘
                                                │
                    ┌───────────────────────────▼──────────┐
                    │     MutationObserver (content.js)     │
                    │  Fires on every new subtitle cue      │
                    │  Auto-detects Japanese (kanji/kana)    │
                    └───────────────────┬──────────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │    Transformation Engine     │
                         │                              │
                         │  ┌────────┐   ┌───────────┐ │
                         │  │LLM Mode│   │Offline Mode│ │
                         │  │(Groq,  │   │(kuromoji + │ │
                         │  │Claude, │   │ JMdict)    │ │
                         │  │OpenAI) │   │            │ │
                         │  └────┬───┘   └─────┬─────┘ │
                         │       └──────┬──────┘       │
                         └──────────────┼──────────────┘
                                        │
                    ┌───────────────────▼──────────────────┐
                    │         Display Renderer              │
                    │  Replace/overlay subtitle DOM          │
                    │  Color-code particles                  │
                    │  requestAnimationFrame (zero stutter)  │
                    └──────────────────────────────────────┘
```

### Transformation Modes

**LLM Mode (Recommended)** — Sends each subtitle cue to the user's configured LLM with an optimized system prompt. Target latency: <400 ms (Groq recommended for speed). Caches translations per episode for instant replay.

**Offline Mode** — Uses bundled kuromoji.js tokenizer to segment Japanese text, then maps each morpheme to English via JMdict/EN glossary. Less accurate on idioms but works without internet and costs nothing.

## Supported Sites

| Site | Method | Status |
|------|--------|--------|
| Aniwave / 9anime mirrors | MutationObserver on custom DOM | Primary target |
| Crunchyroll | MutationObserver + player API | Planned |
| Netflix | Netflix Cadmium subtitle hooks | Planned |
| HIDIVE | MutationObserver | Planned |
| Any HLS site | Configurable selectors | User-configurable |

## Project Structure

```
proper-subs/
├── manifest.json              # Chrome Extension Manifest V3
├── background.js              # Service worker — LLM API calls, caching
├── content.js                 # Content script — MutationObserver, DOM manipulation
├── options/
│   ├── options.html           # Extension options page
│   ├── options.js             # Options logic
│   └── options.css            # Options styling
├── popup/
│   ├── popup.html             # Browser action popup
│   ├── popup.js               # Popup controls (toggle, mode switch)
│   └── popup.css              # Popup styling
├── lib/
│   ├── transformer.js         # LLM transformation engine
│   ├── offline-engine.js      # kuromoji.js + JMdict offline mode
│   ├── parser.js              # Subtitle parsing (VTT/SRT/ASS)
│   ├── display.js             # Subtitle rendering + particle coloring
│   ├── anki-export.js         # Anki card generation
│   ├── dictionary.js          # Click-to-define (Jisho integration)
│   └── site-detect.js         # Streaming site auto-detection
├── data/
│   ├── jmdict-eng.json        # JMdict English glossary (offline mode)
│   └── particles.json         # Particle definitions + color mappings
├── styles/
│   └── subtitle-overlay.css   # Injected subtitle styling
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── .claude/
│   ├── agents/                # Multi-model AI agents (Haiku/Sonnet/Opus)
│   ├── skills/                # test-agent, qa-agent, team-lead
│   ├── roles/                 # Builder + Reviewer collaboration
│   └── board.md               # Collaboration board
└── README.md
```

## Installation

### From Source (Developer)

```bash
git clone https://github.com/MensuraMedia/proper_subs.git
cd proper_subs
```

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `proper-subs/` directory
5. Navigate to any supported streaming site and play anime with Japanese subtitles

### API Key Setup

1. Click the ProperSubs extension icon → **Options**
2. Select your LLM provider (Groq recommended for speed)
3. Paste your API key
4. Choose display preferences (dual mode, particle colors, font size)
5. Start watching — subtitles transform automatically

### Recommended LLM Providers

| Provider | Speed | Cost | Best For |
|----------|-------|------|----------|
| **Groq** | ~200 ms | Free tier available | Primary choice — fastest inference |
| Claude (Anthropic) | ~400 ms | Pay per token | Most accurate particle placement |
| OpenAI (GPT-4o-mini) | ~300 ms | Pay per token | Good balance |
| Gemini (Google) | ~350 ms | Free tier available | Budget option |

## Development Roadmap

| Phase | Milestone | Description |
|-------|-----------|-------------|
| 1 | **Capture** | MutationObserver that logs every subtitle cue on Aniwave |
| 2 | **Transform** | LLM transformation + subtitle text replacement |
| 3 | **Options** | Options page + dual mode + particle coloring |
| 4 | **Export** | Anki export + click-to-define dictionary |
| 5 | **Polish** | Site auto-detection, offline mode, caching |
| 6 | **Publish** | Chrome Web Store listing (free, no ads) |

## Who This Is For

This extension is built for **AJATT (All Japanese All The Time)** and **Refold** method learners who:

- Do heavy anime immersion listening
- Want to understand Japanese sentence structure intuitively
- Are frustrated that English subtitles hide the real word order
- Want to see particles (wa, ga, o, ni) in context as they hear them
- Need a tool that works live during normal watching — not a study app

## Technical Requirements

- **Chrome 110+** (Manifest V3)
- **ES modules** — no eval, no legacy script injection
- **Zero video stutter** — all DOM updates inside `requestAnimationFrame`
- **Graceful degradation** — fallback to polling if MutationObserver is blocked
- **Configurable selectors** — users can add CSS selectors for new streaming sites

## License

MIT — Free and open source. No ads, no tracking, no premium tier.

## Contributing

Contributions welcome. See the development roadmap above for current priorities. The `.claude/` directory contains AI agent definitions for automated QA and testing.
