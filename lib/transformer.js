/**
 * ProperSubs — LLM Transformation Engine
 *
 * Sends Japanese subtitle cues to the configured LLM provider
 * and returns literal structured English with particles.
 * Uses AbortController for clean timeout handling.
 */

// ── System prompt (verbatim from spec) ───────────────────────────────────
const SYSTEM_PROMPT = `You are a Japanese → Literal Structured English converter for language learners.
Rules (never break them):
1. Preserve the EXACT Japanese word order — do not naturalize or reorder anything.
2. After each English word, immediately insert the original Japanese particle exactly as it appears in the sentence (wa, ga, o, ni, de, kara, to, mo, no, etc.).
3. Drop any English words that have no Japanese equivalent (is/are, a/the, etc.).
4. Keep punctuation, timing, and line breaks identical.
5. Output ONLY the structured line — nothing else.
Example:
Input: 私はリンゴを毎日食べます。
Output: I wa apple o every day eat.`;

// ── Provider configurations ──────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    authHeader: key => `Bearer ${key}`
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    authHeader: key => `Bearer ${key}`
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    authHeader: key => key,
    isAnthropic: true
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-2.0-flash',
    authHeader: key => key,
    isGemini: true
  }
};

// ── Constants ────────────────────────────────────────────────────────────
const INAUDIBLE = '[ inaudible ]';
const DEFAULT_TIMEOUT_MS = 2000;

// ── Transform a single cue ──────────────────────────────────────────────
export async function transformCue(japaneseText, options = {}) {
  const {
    provider = 'groq',
    apiKey,
    model,
    mode = 'llm',
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  if (mode === 'offline') {
    return offlineTransform(japaneseText);
  }

  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const selectedModel = model || config.defaultModel;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let result;
    if (config.isAnthropic) {
      result = await callAnthropic(japaneseText, apiKey, selectedModel, controller.signal);
    } else if (config.isGemini) {
      result = await callGemini(japaneseText, apiKey, selectedModel, controller.signal);
    } else {
      result = await callOpenAICompatible(japaneseText, config, apiKey, selectedModel, controller.signal);
    }
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[ProperSubs] ${provider} exceeded ${timeoutMs}ms — showing [inaudible]`);
      return INAUDIBLE;
    }
    console.error(`[ProperSubs] ${provider} API error:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── OpenAI-compatible API (Groq, OpenAI) ─────────────────────────────────
async function callOpenAICompatible(text, config, apiKey, model, signal) {
  const res = await fetch(config.url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': config.authHeader(apiKey)
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      max_tokens: 256
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  const data = await res.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Unexpected API response: missing choices[0].message.content');
  }

  return data.choices[0].message.content.trim();
}

// ── Anthropic API ────────────────────────────────────────────────────────
async function callAnthropic(text, apiKey, model, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: text }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }

  const data = await res.json();

  if (!data.content?.[0]?.text) {
    throw new Error('Unexpected Anthropic response: missing content[0].text');
  }

  return data.content[0].text.trim();
}

// ── Gemini API ───────────────────────────────────────────────────────────
// Note: Gemini requires the API key as a URL query parameter. This is
// Google's API design — the key will appear in network logs. Users should
// be aware of this when selecting Gemini as their provider.
async function callGemini(text, apiKey, model, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: text }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Unexpected Gemini response: missing candidates[0].content.parts[0].text');
  }

  return data.candidates[0].content.parts[0].text.trim();
}

// ── Offline fallback (basic tokenization) ────────────────────────────────
function offlineTransform(text) {
  // Placeholder — Phase 5 will implement kuromoji.js + JMdict
  return `[offline] ${text}`;
}
