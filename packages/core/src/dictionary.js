// Free Dictionary API (dictionaryapi.dev): no key, and only the looked-up word
// leaves the machine. Every failure degrades to "type the meaning yourself".
const DICTIONARY_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const MAX_SENSES = 6;

export function parseEntries(entries) {
  if (!Array.isArray(entries)) return { phonetic: null, senses: [] };

  const phonetic = entries.find((e) => e?.phonetic)?.phonetic
    ?? entries.flatMap((e) => e?.phonetics ?? []).find((p) => p?.text)?.text
    ?? null;

  const senses = [];
  for (const entry of entries) {
    for (const meaning of entry?.meanings ?? []) {
      for (const def of meaning?.definitions ?? []) {
        if (typeof def?.definition !== "string") continue;
        senses.push({
          partOfSpeech: meaning.partOfSpeech ?? null,
          definition: def.definition,
          example: def.example ?? null,
        });
      }
    }
  }
  return { phonetic, senses: senses.slice(0, MAX_SENSES) };
}

export async function lookup(word, { fetchImpl = (...args) => globalThis.fetch(...args), timeoutMs = 6_000 } = {}) {
  let res;
  try {
    res = await fetchImpl(DICTIONARY_URL + encodeURIComponent(word.trim()), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { status: "offline", phonetic: null, senses: [] };
  }

  if (res.status === 404) return { status: "not-found", phonetic: null, senses: [] };
  if (!res.ok) return { status: "error", phonetic: null, senses: [] };

  try {
    const parsed = parseEntries(await res.json());
    return { status: parsed.senses.length ? "ok" : "not-found", ...parsed };
  } catch {
    return { status: "error", phonetic: null, senses: [] };
  }
}
