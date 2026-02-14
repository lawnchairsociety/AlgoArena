import { Module } from '@nestjs/common';
import { AlgoArenaGateway } from './websocket.gateway';
import { WsAuthService } from './ws-auth.service';
import { ConnectionRegistryService } from './connection-registry.service';

@Module({
  providers: [AlgoArenaGateway, WsAuthService, ConnectionRegistryService],
})
export class WebSocketModule {}
