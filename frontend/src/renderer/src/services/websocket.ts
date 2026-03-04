import type { TelemetryData } from "../types/telemetry";

type TelemetryHandler = (data: TelemetryData) => void;
type ConfigHandler = (udpPort: number) => void;
type UDPStatusHandler = (listening: boolean, port: number) => void;

export const DEFAULT_WS_URL = "ws://localhost:8765/ws";
const RECONNECT_MS = 2000;

export class TelemetryWS {
  private ws: WebSocket | null = null;
  private url: string;
  private telemetryHandlers: Set<TelemetryHandler> = new Set();
  private configHandlers: Set<ConfigHandler> = new Set();
  private udpStatusHandlers: Set<UDPStatusHandler> = new Set();
  private stopped = false;

  constructor(url = DEFAULT_WS_URL) {
    this.url = url;
    this.connect();
  }

  /** 修改 WS 地址并重连 */
  setURL(url: string): void {
    this.url = url;
    this.stopped = false;
    this.ws?.close();
  }

  /** 向后端发送指令 */
  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      if (!this.stopped) setTimeout(() => this.connect(), RECONNECT_MS);
      return;
    }

    this.ws.onopen = () => {
      document.dispatchEvent(
        new CustomEvent("ws:status", { detail: "connected" }),
      );
      // 请求后端当前 UDP 状态
      this.send({ type: "getStatus" });
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as {
          type: string;
          data?: TelemetryData;
          udpPort?: number;
          listening?: boolean;
        };
        if (msg.type === "telemetry" && msg.data) {
          this.telemetryHandlers.forEach((h) => h(msg.data!));
        } else if (msg.type === "config" && msg.udpPort) {
          this.configHandlers.forEach((h) => h(msg.udpPort!));
        } else if (msg.type === "udpStatus") {
          const listening = msg.listening ?? false;
          const port = msg.udpPort ?? 0;
          this.udpStatusHandlers.forEach((h) => h(listening, port));
          document.dispatchEvent(
            new CustomEvent("ws:udpStatus", { detail: { listening, port } }),
          );
        }
      } catch {
        /* ignore */
      }
    };

    this.ws.onclose = () => {
      document.dispatchEvent(
        new CustomEvent("ws:status", { detail: "disconnected" }),
      );
      if (!this.stopped) setTimeout(() => this.connect(), RECONNECT_MS);
    };

    this.ws.onerror = () => this.ws?.close();
  }

  onData(handler: TelemetryHandler): () => void {
    this.telemetryHandlers.add(handler);
    return () => this.telemetryHandlers.delete(handler);
  }

  onConfig(handler: ConfigHandler): () => void {
    this.configHandlers.add(handler);
    return () => this.configHandlers.delete(handler);
  }

  onUDPStatus(handler: UDPStatusHandler): () => void {
    this.udpStatusHandlers.add(handler);
    return () => this.udpStatusHandlers.delete(handler);
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
  }
}

export const telemetryWS = new TelemetryWS();
