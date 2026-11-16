import { auth, configuredDatabaseUrl, configuredSecret } from './auth';

export async function requireUser(headers: Headers) {
  if (!configuredDatabaseUrl || !configuredSecret) return null;
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;
  return session.user;
}
