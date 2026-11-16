import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins/bearer';
import { Pool } from 'pg';

const configuredDatabaseUrl = process.env.FACTORYENC_DATABASE_URL;
const configuredSecret = process.env.BETTER_AUTH_SECRET;

// Build workers may not receive project secrets. Safe placeholders let Next.js
// collect route configuration; request handlers reject missing production config.
const poolUrl = configuredDatabaseUrl ?? 'postgres://build:build@127.0.0.1:5432/factoryenc';
const secret = configuredSecret ?? 'build-only-placeholder-never-valid-in-production';
const globalForFactoryEnc = globalThis as unknown as { factoryEncPool?: Pool };
const pool = globalForFactoryEnc.factoryEncPool ?? new Pool({
  connectionString: poolUrl,
  max: 5,
  ssl: { rejectUnauthorized: true },
});
if (process.env.NODE_ENV !== 'production') globalForFactoryEnc.factoryEncPool = pool;

export const auth = betterAuth({
  database: pool,
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  plugins: [bearer()],
});

export { pool, configuredDatabaseUrl, configuredSecret };
