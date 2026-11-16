import { pool } from '../../../../../lib/auth';
import { requireUser } from '../../../../../lib/require-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const user = await requireUser(req.headers);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { id } = await context.params;
  const result = await pool.query(
    `SELECT id,status,package_name,version_name,min_sdk,target_sdk,activities,selected_activities,protection_state,error_code,error_message,created_at,updated_at FROM sde_jobs WHERE id=$1 AND user_id=$2`,
    [id, user.id]
  );
  return result.rowCount ? json(result.rows[0]) : json({ error: 'not_found' }, 404);
}
