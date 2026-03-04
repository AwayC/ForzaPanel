import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class GForceComponent extends BaseComponent {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    super("gforce", "G\u529b");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 250;
    this.canvas.height = 200;
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
    const G = 9.81;
    const gx = d.AccelerationX / G;
    const gy = d.AccelerationY / G;
    const gz = d.AccelerationZ / G; // longitudinal

    const cx = 100;
    const cy = 100;
    const radius = 80;
    const maxG = 2;
    const scale = radius / maxG;

    ctx.clearRect(0, 0, w, h);

    // Draw circles
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let g = 0.5; g <= maxG; g += 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, g * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Plot point (X and Z are horizontal)
    const px = cx + gx * scale;
    const py = cy - gz * scale;

    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = "var(--accent)";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // Show value
    ctx.fillStyle = "white";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.sqrt(gx*gx + gz*gz).toFixed(2)}G`, px, py - 10);

    // Vertical G (Y)
    const vcx = 220;
    const vcy = 100;
    const vh = 160;
    const vscale = (vh / 2) / maxG;

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.strokeRect(vcx - 10, vcy - vh/2, 20, vh);
    
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(vcx - 10, vcy - vh/2, 20, vh);

    const vBarH = gy * vscale;
    ctx.fillStyle = "var(--yellow)";
    if (gy > 0) {
        ctx.fillRect(vcx - 10, vcy - vBarH, 20, vBarH);
    } else {
        ctx.fillRect(vcx - 10, vcy, 20, -vBarH);
    }
    
    ctx.fillStyle = "white";
    ctx.fillText("Y", vcx, vcy + vh/2 + 15);
    ctx.fillText(`${gy.toFixed(2)}`, vcx, vcy - vh/2 - 5);
  }
}
