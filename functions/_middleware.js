// Cloudflare Pages middleware — keep each site reachable only at its custom domain.
//
// CI deploys BOTH Pages projects from the repo root (`wrangler pages deploy dist`
// for the app, `wrangler pages deploy www --project-name=lesslately-www` for the
// landing page), and `wrangler pages deploy` always bundles this functions/ dir
// from the working directory — so this one file ships to both projects. Each
// project only ever receives requests for its own hostnames, so a single
// host -> custom-domain map redirects correctly for both:
//   - trellis-2d9.pages.dev    -> app.lesslately.com   (app project)
//   - lesslately-www.pages.dev -> www.lesslately.com   (landing project)
//
// Matching is exact, so per-deploy preview URLs (<hash>.<alias>.pages.dev) stay
// reachable. Requests to the custom domains pass straight through to the static
// assets, so their _headers (CSP/HSTS) still apply.
const PAGES_DEV_TO_CUSTOM_DOMAIN = {
  'trellis-2d9.pages.dev': 'app.lesslately.com',
  'lesslately-www.pages.dev': 'www.lesslately.com',
}

export const onRequest = (context) => {
  const url = new URL(context.request.url)
  const customDomain = PAGES_DEV_TO_CUSTOM_DOMAIN[url.hostname]
  if (customDomain) {
    url.protocol = 'https:'
    url.hostname = customDomain
    url.port = ''
    return Response.redirect(url.toString(), 301)
  }
  return context.next()
}
