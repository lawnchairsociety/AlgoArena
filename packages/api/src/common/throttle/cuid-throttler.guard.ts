import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface';
import { HEADER_CUID } from '@algoarena/shared';

@Injectable()
export class CuidThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.headers?.[HEADER_CUID] || req.ip;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Skip throttling for WebSocket connections
    if (context.getType() === 'ws') {
      return true;
    }
    return false;
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const {
      context,
      limit,
      ttl,
      throttler,
      blockDuration,
      getTracker,
      generateKey,
    } = requestProps;
    const { req, res } = this.getRequestResponse(context);
    const tracker = await getTracker(req, context);
    const name = throttler.name ?? 'default';
    const key = generateKey(context, tracker, name);
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration,
        name,
      );

    if (isBlocked) {
      res.header('Retry-After', timeToBlockExpire);
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    res.header('X-RateLimit-Limit', limit);
    res.header('X-RateLimit-Remaining', Math.max(0, limit - totalHits));
    res.header('X-RateLimit-Reset', Math.ceil(timeToExpire / 1000));

    return true;
  }
}
