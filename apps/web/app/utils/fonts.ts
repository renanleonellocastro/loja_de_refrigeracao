/** Attribute value on <html data-fonts> that switches the text from the fallback faces to the web fonts. */
export const FONTS_READY = 'ready';

function markFontsReady(): void {
  document.documentElement.dataset.fonts = FONTS_READY;
}

/**
 * Turns the web fonts on once the page has loaded. Until then text uses the metric matched fallback faces
 * (main.css), so the font files never compete with the HTML, CSS, scripts and the largest image (RNF-07).
 */
export function enableWebFontsAfterLoad(page: Window = window): void {
  if (page.document.readyState === 'complete') return markFontsReady();
  page.addEventListener('load', markFontsReady, { once: true });
}
