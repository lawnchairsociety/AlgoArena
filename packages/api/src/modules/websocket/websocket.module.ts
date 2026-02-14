import { Module } from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { AlgoArenaGateway } from './websocket.gateway';
import { WsAuthService } from './ws-auth.service';

@Module({
  providers: [AlgoArenaGateway, WsAuthService, ConnectionRegistryService],
})
export class WebSocketModule {}
