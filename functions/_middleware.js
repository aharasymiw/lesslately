// Cloudflare Pages middleware — keep the production app reachable only at its
// custom domain.
//
// Requests to the project's production pages.dev alias (trellis-2d9.pages.dev)
// are 301-redirected to app.lesslately.com, preserving path and query. This:
//   - takes the production pages.dev URL out of service as a live address,
//   - removes the stale "trellis" URL from search indexes, and
//   - closes the gap where zone-level AI-bot / WAF rules on lesslately.com do
//     not cover *.pages.dev (which would otherwise be an unprotected bypass).
//
// Per-deploy preview URLs (<hash>.trellis-2d9.pages.dev) are intentionally left
// reachable so a build can be spot-checked before it is the custom domain.
// Requests to app.lesslately.com pass straight through to the static assets.
const PRODUCTION_PAGES_DEV = 'trellis-2d9.pages.dev'
const CANONICAL_HOST = 'app.lesslately.com'

export const onRequest = (context) => {
  const url = new URL(context.request.url)
  if (url.hostname === PRODUCTION_PAGES_DEV) {
    url.protocol = 'https:'
    url.hostname = CANONICAL_HOST
    url.port = ''
    return Response.redirect(url.toString(), 301)
  }
  return context.next()
}
