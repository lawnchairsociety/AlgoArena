import * as crypto from 'crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DEFAULT_STARTING_BALANCE, DEFAULT_MARGIN_USED } from '@algoarena/shared';
import { DrizzleProvider } from '../database/drizzle.provider';
import { apiKeys, cuidUsers, positions, borrows } from '../database/schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateCuidUserDto } from './dto/create-cuid-user.dto';
import { ResetAccountDto } from './dto/reset-account.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  async generateApiKey(dto: CreateApiKeyDto) {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await bcrypt.hash(rawKey, 12);

    const [record] = await this.drizzle.db
      .insert(apiKeys)
      .values({ keyHash, keyPrefix, label: dto.label })
      .returning();

    return { ...record, rawKey };
  }

  async revokeApiKey(id: string) {
    const [existing] = await this.drizzle.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.drizzle.db
      .update(apiKeys)
      .set({ isActive: false, revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async createCuidUser(apiKeyId: string, dto: CreateCuidUserDto) {
    const id = this.generateCuid();
    const startingBalance = dto.startingBalance ?? DEFAULT_STARTING_BALANCE;

    const [user] = await this.drizzle.db
      .insert(cuidUsers)
      .values({
        id,
        apiKeyId,
        label: dto.label,
        startingBalance,
        cashBalance: startingBalance,
        pdtEnforced: dto.pdtEnforced ?? true,
      })
      .returning();

    return user;
  }

  async resetAccount(cuid: string, apiKeyId: string, dto: ResetAccountDto) {
    await this.verifyOwnership(apiKeyId, cuid);

    const [user] = await this.drizzle.db
      .select()
      .from(cuidUsers)
      .where(eq(cuidUsers.id, cuid))
      .limit(1);

    if (!user) {
      throw new NotFoundException('CUID user not found');
    }

    const newBalance = dto.startingBalance ?? user.startingBalance;

    await this.drizzle.db.transaction(async (tx) => {
      // Delete all positions
      await tx.delete(positions).where(eq(positions.cuidUserId, cuid));

      // Close all open borrows
      await tx
        .update(borrows)
        .set({ closedAt: new Date() })
        .where(eq(borrows.cuidUserId, cuid));

      // Reset cash balance and margin
      await tx
        .update(cuidUsers)
        .set({
          startingBalance: newBalance,
          cashBalance: newBalance,
          marginUsed: DEFAULT_MARGIN_USED,
        })
        .where(eq(cuidUsers.id, cuid));
    });

    // Return updated user
    const [updated] = await this.drizzle.db
      .select()
      .from(cuidUsers)
      .where(eq(cuidUsers.id, cuid))
      .limit(1);

    return updated;
  }

  async verifyOwnership(apiKeyId: string, cuid: string) {
    const [user] = await this.drizzle.db
      .select()
      .from(cuidUsers)
      .where(eq(cuidUsers.id, cuid))
      .limit(1);

    if (!user) {
      throw new NotFoundException('CUID user not found');
    }

    if (user.apiKeyId !== apiKeyId) {
      throw new ForbiddenException('CUID does not belong to this API key');
    }

    return user;
  }

  async listUsers(apiKeyId: string) {
    return this.drizzle.db
      .select()
      .from(cuidUsers)
      .where(eq(cuidUsers.apiKeyId, apiKeyId));
  }

  async getUser(cuid: string) {
    const [user] = await this.drizzle.db
      .select()
      .from(cuidUsers)
      .where(eq(cuidUsers.id, cuid))
      .limit(1);

    if (!user) {
      throw new NotFoundException('CUID user not found');
    }

    return user;
  }

  private generateCuid(): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const alphanumeric = letters + '0123456789';
    const bytes = crypto.randomBytes(24);
    let result = letters[bytes[0] % 26]; // first char is always a letter
    for (let i = 1; i < 24; i++) {
      result += alphanumeric[bytes[i] % 36];
    }
    return result;
  }
}
