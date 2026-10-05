import { robotsTxt } from '../../app/utils/sitemap';

/** robots.txt: the public site is indexed, the signed in areas are not (issue #77). */
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=86400');
  return robotsTxt(getRequestURL(event).origin);
});
