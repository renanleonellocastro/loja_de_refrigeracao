export interface PageSeo {
  title: string;
  description: string;
  /** Path of the page without query, for the canonical link and og:url. */
  path: string;
}

/** Title, description, canonical link, Open Graph and Twitter card of a public page (issue #77). */
export function usePageSeo(seo: PageSeo): void {
  // The address the site answers on: the production domain in production, localhost in development.
  const origin = useRequestURL().origin;
  const url = `${origin}${seo.path}`;
  const image = `${origin}/og-image.png`;
  useSeoMeta({
    title: seo.title,
    description: seo.description,
    ogTitle: seo.title,
    ogDescription: seo.description,
    ogUrl: url,
    ogImage: image,
    twitterTitle: seo.title,
    twitterDescription: seo.description,
    twitterImage: image,
  });
  useHead({ link: [{ rel: 'canonical', href: url }] });
}
