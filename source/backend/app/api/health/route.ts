export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ service: 'S.D Factory Enc API', status: 'ok', protectionEngine: 'not-installed' }, { headers: { 'cache-control': 'no-store' } });
}
