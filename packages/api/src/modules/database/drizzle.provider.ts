import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

@Injectable()
export class DrizzleProvider implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  public db: NodePgDatabase<typeof schema>;
  private readonly logger = new Logger(DrizzleProvider.name);

  constructor(private readonly configService: ConfigService) {
    const rawUrl = this.configService.getOrThrow<string>('DATABASE_URL');
    const useSSL = rawUrl.includes('sslmode=require') || rawUrl.includes('digitalocean');

    // Strip sslmode from URL so pg doesn't override our ssl config
    const databaseUrl = rawUrl.replace(/[?&]sslmode=[^&]+/, (match) =>
      match.startsWith('?') ? '?' : '',
    ).replace(/\?$/, '');

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });

    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit() {
    try {
      const client = await this.pool.connect();
      client.release();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Database pool closed');
  }
}
