import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins/bearer';
import { Pool } from 'pg';

const databaseUrl = process.env.FACTORYENC_DATABASE_URL;
if (!databaseUrl) throw new Error('FACTORYENC_DATABASE_URL is required');
if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is required');

const globalForFactoryEnc = globalThis as unknown as { factoryEncPool?: Pool };
const pool = globalForFactoryEnc.factoryEncPool ?? new Pool({ connectionString: databaseUrl, max: 5, ssl: { rejectUnauthorized: true } });
if (process.env.NODE_ENV !== 'production') globalForFactoryEnc.factoryEncPool = pool;

export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  plugins: [bearer()],
});

export { pool };
