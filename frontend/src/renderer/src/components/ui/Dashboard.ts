import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class DashboardComponent extends BaseComponent {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private unit: "kmh" | "mph" = "kmh";

  constructor() {
    super("dashboard", "\u4eea\u8868\u76d8");
    this.canvas = document.createElement("canvas");
    this.canvas.width = 300;
    this.canvas.height = 300;
    this.ctx = this.canvas.getContext("2d")!;
    this.render();
  }

  render(): void {
    this.contentElement.appendChild(this.canvas);
    this.canvas.addEventListener("click", () => {
      this.unit = this.unit === "kmh" ? "mph" : "kmh";
    });
  }

  update(d: TelemetryData): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2 + 30;
    const radius = 100;

    ctx.clearRect(0, 0, w, h);

    // RPM Arc (優弧 - Major Arc)
    // From 150 degrees to 30 degrees (clockwise)
    const startAngle = (135 * Math.PI) / 180;
    const endAngle = (45 * Math.PI) / 180;

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.stroke();

    // RPM Progress
    const rpmPct = d.EngineMaxRpm > 0 ? d.CurrentEngineRpm / d.EngineMaxRpm : 0;
    const currentAngle = startAngle + (2 * Math.PI - (startAngle - endAngle)) * rpmPct;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, currentAngle);
    const hue = (1 - rpmPct) * 120; // 120 (green) to 0 (red)
    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.stroke();

    // Speed
    const speed = d.Speed * (this.unit === "kmh" ? 3.6 : 2.23694);
    ctx.fillStyle = "white";
    ctx.font = "bold 60px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(speed).toString(), cx, cy - 15);
    ctx.font = "20px sans-serif";
    ctx.fillText(this.unit.toUpperCase(), cx, cy + 15);

    // Gear
    const gear = d.Gear === 0 ? "N" : d.Gear === 11 ? "R" : d.Gear.toString();
    ctx.font = "bold 80px Orbitron, sans-serif";
    ctx.fillStyle = "var(--accent)";
    ctx.fillText(gear, cx, cy + 95);

    // RPM Labels
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    const maxRpmK = Math.floor(d.EngineMaxRpm / 1000);
    for (let i = 0; i <= maxRpmK; i++) {
      const pct = (i * 1000) / d.EngineMaxRpm;
      const angle = startAngle + (2 * Math.PI - (startAngle - endAngle)) * pct;
      const lx = cx + (radius + 20) * Math.cos(angle);
      const ly = cy + (radius + 20) * Math.sin(angle);
      ctx.fillText(i.toString(), lx, ly);
    }
  }
}
