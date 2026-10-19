export interface PageSeo {
  title: string;
  description: string;
  /** Path of the page without query, for the canonical link and og:url. */
  path: string;
}

/** The same title, description and picture for search results and for links shared on social networks. */
function seoMetaFor(seo: PageSeo, url: string, image: string) {
  return {
    title: seo.title,
    description: seo.description,
    ogTitle: seo.title,
    ogDescription: seo.description,
    ogUrl: url,
    ogImage: image,
    twitterTitle: seo.title,
    twitterDescription: seo.description,
    twitterImage: image,
  };
}

/** Title, description, canonical link, Open Graph and Twitter card of a public page (issue #77). */
export function usePageSeo(seo: PageSeo): void {
  // The address the site answers on: the production domain in production, localhost in development.
  const origin = useRequestURL().origin;
  const url = `${origin}${seo.path}`;
  useSeoMeta(seoMetaFor(seo, url, `${origin}/og-image.png`));
  useHead({ link: [{ rel: 'canonical', href: url }] });
}
