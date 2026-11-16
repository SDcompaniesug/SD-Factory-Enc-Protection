import { pool } from '../../../../../../lib/auth';
import { requireUser } from '../../../../../../lib/require-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req.headers);
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });

  const { id } = await context.params;
  const owned = await pool.query(
    'SELECT id FROM sde_jobs WHERE id=$1 AND user_id=$2',
    [id, user.id]
  );
  if (!owned.rowCount) {
    // Do not disclose whether another account owns this job.
    return Response.json({ error: 'not_found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  // Fail closed even for the owner until the native engine and signing pipeline
  // pass ARM32/ARM64 and physical-device validation.
  return Response.json({
    error: 'protection_engine_not_deployed',
    message: 'Protection remains disabled until the DEX transformation engine, native runtime loader, signing pipeline, and device tests are complete.'
  }, { status: 503, headers: { 'cache-control': 'no-store' } });
}
