/**
 * Translation utility using MyMemory Translation API
 * Free tier: 1000 words/day without registration, 10000 with email
 * https://mymemory.translated.net/doc/spec.php
 */

// Cache to avoid repeated API calls
const translationCache = new Map<string, string>();

/**
 * Translate text from Japanese to English
 */
export async function translateToEnglish(text: string): Promise<string> {
    if (!text || text.trim() === "") return text;

    // Check cache first
    const cached = translationCache.get(text);
    if (cached) return cached;

    // Check if text is already in English (simple heuristic)
    if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text)) {
        return text;
    }

    try {
        const encodedText = encodeURIComponent(text);
        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=ja|en`
        );

        if (!response.ok) {
            console.warn("Translation API error:", response.status);
            return text;
        }

        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            const translated = data.responseData.translatedText;

            // Don't cache if it's the same (indicates translation failed)
            if (translated.toLowerCase() !== text.toLowerCase()) {
                translationCache.set(text, translated);
            }

            return translated;
        }

        return text;
    } catch (error) {
        console.warn("Translation failed:", error);
        return text;
    }
}

/**
 * Translate multiple texts at once (batched)
 */
export async function translateBatch(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const toTranslate: string[] = [];

    // Check cache and identify what needs translation
    for (const text of texts) {
        if (!text || text.trim() === "") {
            results.set(text, text);
            continue;
        }

        const cached = translationCache.get(text);
        if (cached) {
            results.set(text, cached);
        } else if (/^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text)) {
            results.set(text, text);
        } else {
            toTranslate.push(text);
        }
    }

    // Translate in parallel (with some rate limiting)
    const translations = await Promise.all(
        toTranslate.map((text, index) =>
            new Promise<{ original: string; translated: string }>((resolve) => {
                // Stagger requests slightly to avoid rate limiting
                setTimeout(async () => {
                    const translated = await translateToEnglish(text);
                    resolve({ original: text, translated });
                }, index * 100);
            })
        )
    );

    for (const { original, translated } of translations) {
        results.set(original, translated);
    }

    return results;
}

/**
 * Hook for using translations in React components
 */
export function useTranslation(text: string | null | undefined): string {
    // This is a simple version - for a more robust solution,
    // you'd want to use React's useState and useEffect
    return text || "";
}
