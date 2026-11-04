/**
 * Edge Redirect for /news/[slug] -> /noticias/[slug]
 */

export async function onRequest(context) {
  const { params } = context;
  const slug = params.slug || "";
  return Response.redirect(`https://muntru.me/noticias/${slug}`, 302);
}
