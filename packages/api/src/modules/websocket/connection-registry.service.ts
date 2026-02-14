import { WS_MAX_CONNECTIONS_PER_CUID } from '@algoarena/shared';
import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';

@Injectable()
export class ConnectionRegistryService {
  private readonly connections = new Map<string, Set<WebSocket>>();

  add(cuidUserId: string, ws: WebSocket): boolean {
    let userSet = this.connections.get(cuidUserId);
    if (!userSet) {
      userSet = new Set();
      this.connections.set(cuidUserId, userSet);
    }

    if (userSet.size >= WS_MAX_CONNECTIONS_PER_CUID) {
      return false;
    }

    userSet.add(ws);
    return true;
  }

  remove(cuidUserId: string, ws: WebSocket): void {
    const userSet = this.connections.get(cuidUserId);
    if (!userSet) return;

    userSet.delete(ws);
    if (userSet.size === 0) {
      this.connections.delete(cuidUserId);
    }
  }

  getConnections(cuidUserId: string): Set<WebSocket> | undefined {
    return this.connections.get(cuidUserId);
  }

  getAllConnections(): Map<string, Set<WebSocket>> {
    return this.connections;
  }
}
