import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { HEADER_API_KEY } from '@algoarena/shared';
import { DrizzleProvider } from '../../modules/database/drizzle.provider';
import { apiKeys } from '../../modules/database/schema';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawKey = request.headers[HEADER_API_KEY] as string | undefined;

    if (!rawKey || rawKey.length < 8) {
      throw new UnauthorizedException('Missing or invalid API key');
    }

    const prefix = rawKey.substring(0, 8);

    const candidates = await this.drizzle.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, prefix));

    for (const candidate of candidates) {
      if (!candidate.isActive) continue;

      const match = await bcrypt.compare(rawKey, candidate.keyHash);
      if (match) {
        request.apiKeyRecord = candidate;

        // Fire-and-forget lastUsedAt update
        this.drizzle.db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, candidate.id))
          .then(() => {})
          .catch((err) =>
            this.logger.warn(`Failed to update lastUsedAt: ${err.message}`),
          );

        return true;
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }
}
