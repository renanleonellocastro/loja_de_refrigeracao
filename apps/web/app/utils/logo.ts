/**
 * Prepares a brand SVG for inline use: the wrapper element carries the accessible name, so the inner
 * title and role go away. With `reliefId` the letters get the silver gradient and the drop shadow of the sign.
 */
export function inlineLogoSvg(raw: string, reliefId?: string): string {
  let svg = raw
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/ role="img"/, '')
    .replace(/ aria-label="[^"]*"/, '')
    .replace('<svg ', '<svg aria-hidden="true" focusable="false" class="block h-full w-auto" ');
  if (reliefId) {
    const defs =
      `<defs><linearGradient id="${reliefId}-silver" x1="0" y1="0" x2="0" y2="1">` +
      '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#E9ECEF"/>' +
      '<stop offset="1" stop-color="#C8CCD2"/></linearGradient>' +
      `<filter id="${reliefId}-relief" x="-10%" y="-10%" width="120%" height="130%">` +
      '<feDropShadow dx="2.5" dy="4" stdDeviation="2.2" flood-color="#06162A" flood-opacity="0.55"/></filter></defs>';
    svg = svg
      .replace(/(<svg[^>]*>)/, `$1${defs}`)
      .replace(
        '<g fill="currentColor">',
        `<g fill="url(#${reliefId}-silver)" filter="url(#${reliefId}-relief)">`,
      );
  }
  return svg;
}
