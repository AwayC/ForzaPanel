import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class MiniMapComponent extends BaseComponent {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private points: { x: number; z: number }[] = [];
  private lastIsRaceOn = 0;

  constructor() {
    super("minimap", "\u5b9e\u65f6\u8def\u7ebf");
    this.canvas = document.createElement("canvas");
    this.canvas.className = "minimap-canvas";
    this.canvas.width = 400;
    this.canvas.height = 300;
    this.ctx = this.canvas.getContext("2d")!;
    this.render();

    window.addEventListener("replay:start", () => {
      this.points = [];
      this.draw();
    });
  }

  render(): void {
    this.contentElement.appendChild(this.canvas);
  }

  update(d: TelemetryData): void {
    if (d.IsRaceOn === 1 && this.lastIsRaceOn === 0) {
      // Clear points only if distance is large, similar to RouteMap
      if (this.points.length > 0) {
        const last = this.points[this.points.length - 1];
        const distSq = Math.pow(d.PositionX - last.x, 2) + Math.pow(d.PositionZ - last.z, 2);
        if (distSq > 10000) {
          this.points = [];
        }
      } else {
        this.points = [];
      }
    }
    this.lastIsRaceOn = d.IsRaceOn;

    if (d.IsRaceOn === 1) {
      if (this.points.length > 0) {
        const last = this.points[this.points.length - 1];
        const distSq = Math.pow(d.PositionX - last.x, 2) + Math.pow(d.PositionZ - last.z, 2);
        if (distSq < 4) return; // Only push if moved by 2+ meters
      }
      
      this.points.push({ x: d.PositionX, z: d.PositionZ });
      if (this.points.length > 5000) this.points.shift();
      this.draw();
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.points.length < 2) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    }

    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const scale = Math.min((w - 20) / rangeX, (h - 20) / rangeZ);
    
    ctx.strokeStyle = "#00c8ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const sx = (p.x - minX) * scale + 10;
      const sy = h - ((p.z - minZ) * scale + 10);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Draw current position
    const last = this.points[this.points.length - 1];
    const lx = (last.x - minX) * scale + 10;
    const ly = h - ((last.z - minZ) * scale + 10);
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
