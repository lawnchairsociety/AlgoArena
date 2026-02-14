import { z } from 'zod';

export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis/Valkey
  REDIS_URL: z.string(),

  // Market data provider
  MARKET_DATA_PROVIDER: z.string().default('alpaca'),

  // Alpaca (required when MARKET_DATA_PROVIDER=alpaca)
  ALPACA_API_URL: z.string().url().optional(),
  ALPACA_API_KEY: z.string().min(1).optional(),
  ALPACA_API_SECRET: z.string().min(1).optional(),

  // Master key for admin operations
  MASTER_KEY: z.string().min(1).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}
