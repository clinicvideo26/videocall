import { NextResponse } from "next/server";

// The doctor browser extension calls these JSON APIs from its own
// `chrome-extension://<id>` origin. Auth is a Bearer token (never cookies), so
// there are no ambient credentials for another origin to abuse — a permissive
// CORS origin is safe here. The extension id isn't known at build time, so we
// allow any origin rather than hard-coding one.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/** JSON response with CORS headers, for the extension API routes. */
export function corsJson(data: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

/** Preflight (OPTIONS) response. Export as the route's `OPTIONS` handler. */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
