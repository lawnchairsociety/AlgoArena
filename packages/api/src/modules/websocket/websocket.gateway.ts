import { IncomingMessage } from 'node:http';
import { WS_HEARTBEAT_INTERVAL_MS, WS_PATH, WsEventEnvelope, WsEventType } from '@algoarena/shared';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import { WebSocket, WebSocketServer } from 'ws';
import { ConnectionRegistryService } from './connection-registry.service';
import { WsAuthService } from './ws-auth.service';
import {
  MarginLiquidationPayload,
  MarginWarningPayload,
  OptionExpiredPayload,
  OrderEventPayload,
  PdtRestrictedPayload,
  PdtWarningPayload,
} from './ws-event.types';

interface TaggedWebSocket extends WebSocket {
  cuidUserId?: string;
  isAlive?: boolean;
}

@WebSocketGateway({ path: WS_PATH })
export class AlgoArenaGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(AlgoArenaGateway.name);
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly registry: ConnectionRegistryService,
  ) {}

  afterInit(_server: WebSocketServer): void {
    this.logger.log(`WebSocket gateway initialized on ${WS_PATH}`);

    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, WS_HEARTBEAT_INTERVAL_MS);
  }

  async handleConnection(client: TaggedWebSocket, request: IncomingMessage): Promise<void> {
    const authResult = await this.wsAuth.authenticate(request);

    if (!authResult) {
      client.close(1008, 'Unauthorized');
      return;
    }

    const added = this.registry.add(authResult.cuidUserId, client);
    if (!added) {
      client.close(1013, 'Too many connections');
      return;
    }

    client.cuidUserId = authResult.cuidUserId;
    client.isAlive = true;

    client.on('pong', () => {
      client.isAlive = true;
    });

    // Send welcome heartbeat
    this.sendDirect(client, 'heartbeat', { message: 'connected' });

    this.logger.log(`WS connected: ${authResult.cuidUserId}`);
  }

  handleDisconnect(client: TaggedWebSocket): void {
    if (client.cuidUserId) {
      this.registry.remove(client.cuidUserId, client);
      this.logger.log(`WS disconnected: ${client.cuidUserId}`);
    }
  }

  onModuleDestroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ── Heartbeat ──

  private heartbeat(): void {
    const allConnections = this.registry.getAllConnections();
    for (const [, sockets] of allConnections) {
      for (const ws of sockets) {
        const tagged = ws as TaggedWebSocket;
        if (tagged.isAlive === false) {
          tagged.terminate();
          continue;
        }
        tagged.isAlive = false;
        tagged.ping();
        this.sendDirect(tagged, 'heartbeat', { timestamp: new Date().toISOString() });
      }
    }
  }

  // ── Event Handlers ──

  @OnEvent('order.filled')
  handleOrderFilled(payload: OrderEventPayload): void {
    this.sendToUser(payload.cuidUserId, 'order.filled', payload);
  }

  @OnEvent('order.partially_filled')
  handleOrderPartiallyFilled(payload: OrderEventPayload): void {
    this.sendToUser(payload.cuidUserId, 'order.partially_filled', payload);
  }

  @OnEvent('order.cancelled')
  handleOrderCancelled(payload: OrderEventPayload): void {
    this.sendToUser(payload.cuidUserId, 'order.cancelled', payload);
  }

  @OnEvent('order.rejected')
  handleOrderRejected(payload: OrderEventPayload): void {
    this.sendToUser(payload.cuidUserId, 'order.rejected', payload);
  }

  @OnEvent('order.expired')
  handleOrderExpired(payload: OrderEventPayload): void {
    this.sendToUser(payload.cuidUserId, 'order.expired', payload);
  }

  @OnEvent('margin.warning')
  handleMarginWarning(payload: MarginWarningPayload): void {
    this.sendToUser(payload.cuidUserId, 'margin.warning', payload);
  }

  @OnEvent('margin.liquidation')
  handleMarginLiquidation(payload: MarginLiquidationPayload): void {
    this.sendToUser(payload.cuidUserId, 'margin.liquidation', payload);
  }

  @OnEvent('pdt.warning')
  handlePdtWarning(payload: PdtWarningPayload): void {
    this.sendToUser(payload.cuidUserId, 'pdt.warning', payload);
  }

  @OnEvent('pdt.restricted')
  handlePdtRestricted(payload: PdtRestrictedPayload): void {
    this.sendToUser(payload.cuidUserId, 'pdt.restricted', payload);
  }

  @OnEvent('option.expired')
  handleOptionExpired(payload: OptionExpiredPayload): void {
    this.sendToUser(payload.cuidUserId, 'option.expired', payload);
  }

  // ── Helpers ──

  private sendToUser(cuidUserId: string, type: WsEventType, data: object & { cuidUserId: string }): void {
    const connections = this.registry.getConnections(cuidUserId);
    if (!connections) return;

    // Strip cuidUserId from the client payload
    const { cuidUserId: _, ...clientData } = data as Record<string, unknown>;
    const envelope: WsEventEnvelope = {
      type,
      timestamp: new Date().toISOString(),
      data: clientData,
    };

    const message = JSON.stringify(envelope);
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  private sendDirect(ws: TaggedWebSocket, type: WsEventType, data: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const envelope: WsEventEnvelope = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    ws.send(JSON.stringify(envelope));
  }
}
