import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/api/src/modules/database/schema/index.ts',
  out: './packages/api/src/modules/database/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
