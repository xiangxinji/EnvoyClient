import { EventEmitter } from "../../envoy/packages/core/event-emitter";
import {
  type Message,
  serializeMessage,
  deserializeMessage,
} from "../../envoy/packages/core/message";

export interface ClientTransportOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class ClientTransport extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  constructor(private options: ClientTransportOptions) {
    super();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.url);

      ws.onopen = () => {
        this.ws = ws;
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit("open");
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = deserializeMessage(event.data as string);
          this.emit("message", msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.emit("close");
        this.tryReconnect();
      };

      ws.onerror = () => {
        if (!this.connected) {
          reject(new Error("Connection failed"));
        } else {
          this.emit("error", new Error("WebSocket error"));
        }
      };
    });
  }

  send(message: Message): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(serializeMessage(message));
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.options.reconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private tryReconnect(): void {
    if (!this.options.reconnect) return;

    const max = this.options.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= max) {
      this.emit("reconnect_failed");
      return;
    }

    const interval = this.options.reconnectInterval ?? 3000;
    const delay = interval * Math.min(this.reconnectAttempts + 1, 5);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.emit("reconnecting", this.reconnectAttempts);
      this.connect().catch(() => {
        // reconnect will be tried again on close
      });
    }, delay);
  }
}
