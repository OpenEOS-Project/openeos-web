/**
 * Health check for the container (Dockerfile HEALTHCHECK) and for rollouts:
 * a new instance only gets traffic once this answers 200. Deliberately
 * light — no API call, no rendering — so it says "this server is up",
 * not "the backend is up".
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      status: 'ok',
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
