import { pool } from '../../../../../../lib/auth';
import { requireUser } from '../../../../../../lib/require-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const user = await requireUser(req.headers);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as { activities?: unknown } | null;
  if (!body || !Array.isArray(body.activities) || body.activities.length > 500 || body.activities.some(x => typeof x !== 'string' || x.length > 512)) return json({ error: 'invalid_selection' }, 400);
  const result = await pool.query(
    `UPDATE sde_jobs SET selected_activities=$3,updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('ready','uploaded') RETURNING id,selected_activities`,
    [id, user.id, body.activities]
  );
  return result.rowCount ? json(result.rows[0]) : json({ error: 'job_not_selectable_or_not_found' }, 409);
}
