export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = async (
  error: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) => {
  const Sentry = await import('@sentry/nextjs');
  const { scrubRequestInfo } = await import('./lib/error-report-scrub.mjs');

  // Nicht die vollstaendige Anfrage weitergeben: Kopfzeilen wie Cookie,
  // Authorization oder Geraete-Token sowie Query-Strings bleiben draussen.
  Sentry.captureException(error, {
    extra: {
      request: scrubRequestInfo(request),
      context,
    },
  });
};
