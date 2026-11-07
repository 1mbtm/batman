// Cloudflare Pages Middleware for Agentic Readiness & Accept-Header Content Negotiation
// Docs: https://developers.cloudflare.com/pages/platform/functions/middleware/

interface Env {
  ASSETS: {
    fetch: (request: Request | string | URL) => Promise<Response>;
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const acceptHeader = request.headers.get('Accept') || '';

  // 1. Markdown Content Negotiation (acceptmarkdown.com compliance)
  // When an AI agent requests Accept: text/markdown on HTML routes, serve llms.txt with proper Vary headers
  const isStaticAsset = /\.(png|webp|svg|jpg|jpeg|gif|ico|mp3|css|js|map|json|xml|txt|html)$/i.test(url.pathname);
  
  if (acceptHeader.includes('text/markdown') && !isStaticAsset) {
    const llmsRes = await env.ASSETS.fetch(new URL('/llms.txt', request.url));
    if (llmsRes.ok) {
      const markdownBody = await llmsRes.text();
      return new Response(markdownBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept, Accept-Encoding',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  // 2. API Routes handling (/api/* except dynamic /api/analytics/*)
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/analytics')) {
    // Check if matching static JSON endpoint exists in /api/v1/
    let apiAssetUrl = url.pathname;
    if (!apiAssetUrl.endsWith('.json')) {
      apiAssetUrl = `${apiAssetUrl}.json`;
    }

    const apiRes = await env.ASSETS.fetch(new URL(apiAssetUrl, request.url));
    if (apiRes.ok) {
      const body = await apiRes.text();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'RateLimit-Limit': '100',
          'RateLimit-Remaining': '99',
          'RateLimit-Reset': '60',
          'Vary': 'Accept, Accept-Encoding',
          'Cache-Control': 'public, max-age=600',
        },
      });
    }

    // Otherwise return RFC 9457 Problem Details JSON 404
    const errorRes = await env.ASSETS.fetch(new URL('/error.json', request.url));
    const errorBody = errorRes.ok ? await errorRes.text() : JSON.stringify({
      type: 'https://batman-7y3.pages.dev/developers/errors#not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: `API endpoint '${url.pathname}' does not exist. Refer to /openapi.json for valid endpoints.`,
      instance: url.pathname,
      code: 'RESOURCE_NOT_FOUND',
      resolution: 'Check the OpenAPI specification at https://batman-7y3.pages.dev/openapi.json for all valid API endpoints.',
    });

    return new Response(errorBody, {
      status: 404,
      headers: {
        'Content-Type': 'application/problem+json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'RateLimit-Limit': '100',
        'RateLimit-Remaining': '99',
        'RateLimit-Reset': '60',
        'Vary': 'Accept, Accept-Encoding',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 3. Normal HTML / Asset request handling
  const response = await context.next();

  // Ensure Vary header always includes Accept, Accept-Encoding for crawler caching correctness
  const headers = new Headers(response.headers);
  const currentVary = headers.get('Vary') || '';
  if (!currentVary.includes('Accept')) {
    headers.set('Vary', currentVary ? `${currentVary}, Accept` : 'Accept, Accept-Encoding');
  }
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
