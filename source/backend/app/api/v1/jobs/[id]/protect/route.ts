import { requireUser } from '../../../../../../lib/require-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await requireUser(req.headers);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  return Response.json({ error: 'protection_engine_not_deployed', message: 'Protection remains disabled until the DEX transformation engine, native runtime loader, signing pipeline, and device tests are complete.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
}
