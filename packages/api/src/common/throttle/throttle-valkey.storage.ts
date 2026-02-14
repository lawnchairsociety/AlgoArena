import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ValkeyProvider } from '../../modules/cache/valkey.provider';

@Injectable()
export class ThrottleValkeyStorage implements ThrottlerStorage {
  constructor(private readonly valkey: ValkeyProvider) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const storageKey = `throttle:${throttlerName}:${key}`;
    const ttlSeconds = Math.ceil(ttl / 1000);

    const totalHits = await this.valkey.client.incr(storageKey);
    if (totalHits === 1) {
      await this.valkey.client.expire(storageKey, ttlSeconds);
    }

    const timeToExpire = await this.valkey.client.ttl(storageKey);
    const isBlocked = totalHits > limit;

    if (isBlocked && blockDuration > 0) {
      const blockSeconds = Math.ceil(blockDuration / 1000);
      await this.valkey.client.expire(storageKey, blockSeconds);
    }

    return {
      totalHits,
      timeToExpire: Math.max(timeToExpire, 0) * 1000,
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.max(timeToExpire, 0) * 1000 : 0,
    };
  }
}
