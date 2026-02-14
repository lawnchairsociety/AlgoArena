import { HEADER_CUID } from '@algoarena/shared';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleProvider } from '../../modules/database/drizzle.provider';
import { apiKeys, cuidUsers } from '../../modules/database/schema';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class CuidGuard implements CanActivate {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cuid = request.headers[HEADER_CUID] as string | undefined;

    if (!cuid) {
      throw new UnauthorizedException('Missing CUID header');
    }

    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, cuid)).limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid CUID');
    }

    // Passive check: verify parent API key is still active
    const [parentKey] = await this.drizzle.db.select().from(apiKeys).where(eq(apiKeys.id, user.apiKeyId)).limit(1);

    if (!parentKey || !parentKey.isActive) {
      throw new UnauthorizedException('Parent API key has been revoked');
    }

    // If ApiKeyGuard ran first, verify the API key owns this CUID
    if (request.apiKeyRecord && user.apiKeyId !== request.apiKeyRecord.id) {
      throw new UnauthorizedException('API key does not own this CUID');
    }

    request.cuidUserRecord = user;
    return true;
  }
}
