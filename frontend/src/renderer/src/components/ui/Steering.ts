import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class SteeringComponent extends BaseComponent {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    super("steering", "\u8f6c\u5411");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 250;
    this.canvas.height = 150;
    this.ctx = this.canvas.getContext("2d")!;
    this.render();
  }

  render(): void {
    this.contentElement.appendChild(this.canvas);
  }

  update(d: TelemetryData): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h - 20;
    const radius = 100;

    ctx.clearRect(0, 0, w, h);

    // Semi-circle background
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 15;
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius - 10);
    ctx.lineTo(cx, cy - radius + 10);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.stroke();

    // Steer progress (-127 to +127)
    const steerPct = d.Steer / 127; // -1 to 1
    const angle = (1.5 + steerPct / 2) * Math.PI;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 1.5 * Math.PI, angle, steerPct < 0);
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 15;
    ctx.stroke();

    // Value
    ctx.fillStyle = "white";
    ctx.font = "bold 24px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${d.Steer}`, cx, cy - 20);
  }
}
