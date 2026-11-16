import { pool, configuredDatabaseUrl, configuredSecret } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'cache-control': 'no-store' };
  if (!configuredDatabaseUrl || !configuredSecret) {
    return Response.json(
      { service: 'S.D Factory Enc API', status: 'unhealthy', database: 'not_configured', protectionEngine: 'not-installed' },
      { status: 503, headers }
    );
  }

  try {
    await pool.query('SELECT 1');
    return Response.json(
      { service: 'S.D Factory Enc API', status: 'ok', database: 'connected', protectionEngine: 'not-installed' },
      { headers }
    );
  } catch {
    return Response.json(
      { service: 'S.D Factory Enc API', status: 'degraded', database: 'unavailable', protectionEngine: 'not-installed' },
      { status: 503, headers }
    );
  }
}
