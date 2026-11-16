import { auth } from './auth';

export async function requireUser(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;
  return session.user;
}
