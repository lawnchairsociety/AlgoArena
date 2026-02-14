import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HEADER_MASTER_KEY } from '@algoarena/shared';

@Injectable()
export class MasterKeyGuard implements CanActivate {
  private readonly logger = new Logger(MasterKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const masterKey = this.configService.get<string>('MASTER_KEY');

    if (!masterKey) {
      this.logger.warn('MASTER_KEY not configured — endpoint disabled');
      throw new ForbiddenException('This endpoint is disabled');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers[HEADER_MASTER_KEY];

    if (!provided || provided !== masterKey) {
      throw new ForbiddenException('Invalid master key');
    }

    return true;
  }
}
