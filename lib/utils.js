import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-extra';

export function normalizeUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) return 'https://www.google.com';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[\w.-]+\.[a-z]{2,}$/i.test(trimmed)) return `https://${trimmed}`;
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export async function applyChromeSpoofs(page) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/128.0.0.0 Safari/537.36"
            );

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, "webdriver", { 
                    get: () => false 
                });

                Object.defineProperty(navigator, "plugins", { 
                    get: () => [1,2,3,4,5] 
                });

                Object.defineProperty(navigator, "languages", { 
                    get: () => ["en-US", "en"] 
                });
            });

            return;
        } catch (err) {
            console.warn(`[Spoof] Attempt ${attempt} failed:`, err.message);
            await page.waitForTimeout(1000);
        }
    }
    console.warn("[Spoof] Failed to apply Chrome spoofs after 3 attempts");
}

export async function resolveChromePath() {
    try {
        const installations = chromeLauncher.getInstallations();
        if (installations.length > 0) return installations[0];
    } catch (err) {
        console.log('[ChromeFinder] No system Chrome found, fallback to Puppeteer Chromium');
    }

    return puppeteer.executablePath();
}