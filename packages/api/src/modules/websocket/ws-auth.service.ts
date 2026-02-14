import { IncomingMessage } from 'node:http';
import { HEADER_API_KEY, HEADER_CUID } from '@algoarena/shared';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DrizzleProvider } from '../database/drizzle.provider';
import { apiKeys, cuidUsers } from '../database/schema';

export interface WsAuthResult {
  cuidUserId: string;
  apiKeyId: string;
}

@Injectable()
export class WsAuthService {
  constructor(private readonly drizzle: DrizzleProvider) {}

  async authenticate(request: IncomingMessage): Promise<WsAuthResult | null> {
    const rawKey = request.headers[HEADER_API_KEY] as string | undefined;
    const cuid = request.headers[HEADER_CUID] as string | undefined;

    if (!rawKey || rawKey.length < 8 || !cuid) {
      return null;
    }

    // Validate API key: prefix lookup → bcrypt compare → check isActive
    const prefix = rawKey.substring(0, 8);
    const candidates = await this.drizzle.db.select().from(apiKeys).where(eq(apiKeys.keyPrefix, prefix));

    let matchedKeyId: string | null = null;

    for (const candidate of candidates) {
      if (!candidate.isActive) continue;

      const match = await bcrypt.compare(rawKey, candidate.keyHash);
      if (match) {
        matchedKeyId = candidate.id;
        break;
      }
    }

    if (!matchedKeyId) {
      return null;
    }

    // Validate CUID: user exists → parent API key active → key owns CUID
    const [user] = await this.drizzle.db.select().from(cuidUsers).where(eq(cuidUsers.id, cuid)).limit(1);

    if (!user) {
      return null;
    }

    // Verify the API key owns this CUID
    if (user.apiKeyId !== matchedKeyId) {
      return null;
    }

    // Verify parent API key is active
    const [parentKey] = await this.drizzle.db.select().from(apiKeys).where(eq(apiKeys.id, user.apiKeyId)).limit(1);

    if (!parentKey || !parentKey.isActive) {
      return null;
    }

    return { cuidUserId: user.id, apiKeyId: matchedKeyId };
  }
}
