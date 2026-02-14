import { Module, Global } from '@nestjs/common';
import { ValkeyProvider } from './valkey.provider';

@Global()
@Module({
  providers: [ValkeyProvider],
  exports: [ValkeyProvider],
})
export class CacheModule {}
