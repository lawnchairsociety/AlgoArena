import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
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
}
