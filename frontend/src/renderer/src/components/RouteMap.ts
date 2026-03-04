import type { TelemetryData } from "../types/telemetry";

const MAX_POINTS = 500_000;

interface Point3D {
  x: number;
  y: number;
  z: number;
  speed: number;
  drivingLine: number; // NormalizedDrivingLine: -127~+127，0=理想赛线
  brakeDiff: number;    // NormalizedAIBrakeDifference
}

export class RouteMap {
  private container: HTMLElement;
  private canvas2D!: HTMLCanvasElement;
  private canvas3D!: HTMLCanvasElement;
  private ctx2D!: CanvasRenderingContext2D;
  private ctx3D!: CanvasRenderingContext2D;
  private points: Point3D[] = [];
  private recording = true;
  private show3D = false;
  private colorMode: "speed" | "drivingLine" | "brakeDiff" = "speed";
  private lastIsRaceOn = 0;

  // Bounds & Stats
  private minX = Infinity;
  private maxX = -Infinity;
  private minY = Infinity;
  private maxY = -Infinity;
  private minZ = Infinity;
  private maxZ = -Infinity;
  private maxSpd = 0;

  // 3D rotation / zoom
  private rotX = 30;
  private rotY = 225;
  private scale2D = 1;
  private scale3D = 1;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };

  // 2D pan
  private pan2D = { x: 0, y: 0 };
  private panning = false;
  private panStart = { mx: 0, my: 0, px: 0, py: 0 };

  private animId = 0;
  private dirty = true;

  constructor(container: HTMLElement) {
    this.container = container;
    this.buildHTML();
    this.bindControls();
    this.scheduleRender();
    
    window.addEventListener("replay:start", () => {
      this.points = [];
      this.resetBounds();
      this.updateCount();
      this.dirty = true;
    });
  }

  /* ── HTML ──────────────────────────────────────────────────────────────── */

  private buildHTML(): void {
    this.container.innerHTML = `
      <div class="rm-wrap">
        <div class="rm-toolbar">
          <button id="rm-toggle-btn" class="rm-btn rm-toggle rm-active" title="折叠/展开">▼ 路线地图</button>
          <div class="rm-divider"></div>
          <button id="rm-record-btn" class="rm-btn rm-active">⏺ 记录中</button>
          <button id="rm-clear-btn" class="rm-btn">🗑 清除</button>
          <span id="rm-count" class="rm-info">0 点</span>
          <div style="flex:1"></div>
          <button id="rm-color-btn" class="rm-btn rm-active" title="切换路线着色模式">🎨 速度</button>
          <button id="rm-2d-btn" class="rm-btn rm-active">2D 俯视</button>
          <button id="rm-3d-btn" class="rm-btn">3D 视图</button>
          <button id="rm-reset-btn" class="rm-btn">⌖ 重置视角</button>
        </div>
        <div class="rm-body">
          <div class="rm-canvases" id="rm-canvases">
            <canvas id="rm-c2d" class="rm-canvas"></canvas>
            <canvas id="rm-c3d" class="rm-canvas rm-hidden"></canvas>
          </div>
          <div class="rm-hint">
            2D: 滚轮缩放 · 右键拖拽平移 &nbsp;|&nbsp;
            3D: 左键拖拽旋转 · 滚轮缩放
          </div>
        </div>
      </div>`;

    const wrap = this.container.querySelector<HTMLElement>("#rm-canvases")!;
    this.canvas2D = this.container.querySelector<HTMLCanvasElement>("#rm-c2d")!;
    this.canvas3D = this.container.querySelector<HTMLCanvasElement>("#rm-c3d")!;
    this.ctx2D = this.canvas2D.getContext("2d")!;
    this.ctx3D = this.canvas3D.getContext("2d")!;

    this._resize = () => {
      const r = wrap.getBoundingClientRect();
      const w = r.width > 10 ? r.width : wrap.offsetWidth || 800;
      const h = r.height > 10 ? r.height : wrap.offsetHeight || 420;
      if (this.canvas2D.width === w && this.canvas2D.height === h) return;
      this.canvas2D.width = w;
      this.canvas2D.height = h;
      this.canvas3D.width = w;
      this.canvas3D.height = h;
      this.dirty = true;
    };
    this._resize();
    window.addEventListener("resize", this._resize);

    const ro = new ResizeObserver(() => {
      this._resize();
    });
    ro.observe(wrap);
  }

  onVisible(): void {
    this._resize();
    this.dirty = true;
  }

  private _resize: () => void = () => {};

  /* ── Controls ──────────────────────────────────────────────────────────── */

  private bindControls(): void {
    const btn2D = this.container.querySelector<HTMLButtonElement>("#rm-2d-btn")!;
    const btn3D = this.container.querySelector<HTMLButtonElement>("#rm-3d-btn")!;
    const recordBtn = this.container.querySelector<HTMLButtonElement>("#rm-record-btn")!;
    const clearBtn = this.container.querySelector<HTMLButtonElement>("#rm-clear-btn")!;
    const resetBtn = this.container.querySelector<HTMLButtonElement>("#rm-reset-btn")!;
    const colorBtn = this.container.querySelector<HTMLButtonElement>("#rm-color-btn")!;
    const toggleBtn = this.container.querySelector<HTMLButtonElement>("#rm-toggle-btn")!;
    const wrap = this.container.querySelector<HTMLElement>(".rm-wrap")!;

    toggleBtn.addEventListener("click", () => {
      const collapsed = wrap.classList.toggle("rm-collapsed");
      toggleBtn.textContent = collapsed ? "\u25b6 \u8def\u7ebf\u5730\u56fe" : "\u25bc \u8def\u7ebf\u5730\u56fe";
      toggleBtn.classList.toggle("rm-active", !collapsed);
      if (!collapsed) {
        requestAnimationFrame(() => this._resize());
      }
    });

    colorBtn.addEventListener("click", () => {
      if (this.colorMode === "speed") this.colorMode = "drivingLine";
      else if (this.colorMode === "drivingLine") this.colorMode = "brakeDiff";
      else this.colorMode = "speed";

      const labels = {
        speed: "\ud83c\udfa8 \u901f\u5ea6",
        drivingLine: "\ud83c\udfaf \u9a7e\u9a76\u7ebf",
        brakeDiff: "\u26a0\ufe0f \u5239\u8f66\u5dee"
      };
      colorBtn.textContent = labels[this.colorMode];
      this.dirty = true;
    });

    recordBtn.addEventListener("click", () => {
      this.recording = !this.recording;
      recordBtn.textContent = this.recording ? "\u23fa \u8bb0\u5f55\u4e2d" : "\u23f8 \u5df2\u6682\u505c";
      recordBtn.classList.toggle("rm-active", this.recording);
    });

    clearBtn.addEventListener("click", () => {
      this.points = [];
      this.dirty = true;
      this.updateCount();
    });

    resetBtn.addEventListener("click", () => {
      this.rotX = 30;
      this.rotY = 225;
      this.scale2D = 1;
      this.scale3D = 1;
      this.pan2D = { x: 0, y: 0 };
      this.dirty = true;
    });

    btn2D.addEventListener("click", () => {
      this.show3D = false;
      this.canvas2D.classList.remove("rm-hidden");
      this.canvas3D.classList.add("rm-hidden");
      btn2D.classList.add("rm-active");
      btn3D.classList.remove("rm-active");
      this.dirty = true;
    });

    btn3D.addEventListener("click", () => {
      this.show3D = true;
      this.canvas3D.classList.remove("rm-hidden");
      this.canvas2D.classList.add("rm-hidden");
      btn3D.classList.add("rm-active");
      btn2D.classList.remove("rm-active");
      this.dirty = true;
    });

    this.canvas3D.addEventListener("mousedown", (e) => {
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });

    this.canvas2D.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        this.panning = true;
        this.panStart = {
          mx: e.clientX,
          my: e.clientY,
          px: this.pan2D.x,
          py: this.pan2D.y,
        };
        e.preventDefault();
      }
    });
    this.canvas2D.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousemove", (e) => {
      if (this.dragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.rotY += dx * 0.4;
        this.rotX = Math.max(-89, Math.min(89, this.rotX + dy * 0.4));
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dirty = true;
      }
      if (this.panning) {
        this.pan2D.x = this.panStart.px + (e.clientX - this.panStart.mx);
        this.pan2D.y = this.panStart.py + (e.clientY - this.panStart.my);
        this.dirty = true;
      }
    });

    document.addEventListener("mouseup", () => {
      this.dragging = false;
      this.panning = false;
    });

    const zoomHandler = (e: WheelEvent, is3D: boolean) => {
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      if (is3D) {
        this.scale3D = Math.max(0.05, Math.min(50, this.scale3D * factor));
      } else {
        this.scale2D = Math.max(0.05, Math.min(50, this.scale2D * factor));
      }
      this.dirty = true;
      e.preventDefault();
    };
    this.canvas2D.addEventListener("wheel", (e) => zoomHandler(e, false), { passive: false });
    this.canvas3D.addEventListener("wheel", (e) => zoomHandler(e, true), { passive: false });
  }

  /* ── Data push ─────────────────────────────────────────────────────────── */

  push(d: TelemetryData): void {
    // Check if race just started
    if (d.IsRaceOn === 1 && this.lastIsRaceOn === 0) {
      // Clear if there are existing points AND the new position is far away from the last point
      if (this.points.length > 0) {
        const lastP = this.points[this.points.length - 1];
        const distSq = Math.pow(d.PositionX - lastP.x, 2) + Math.pow(d.PositionY - lastP.y, 2) + Math.pow(d.PositionZ - lastP.z, 2);
        // If distance is large (e.g. > 100 meters squared), we assume it's a new track/race
        if (distSq > 10000) {
          this.points = [];
          this.resetBounds();
        }
      } else {
        this.points = [];
        this.resetBounds();
      }
      this.updateCount();
    }
    
    this.lastIsRaceOn = d.IsRaceOn;

    if (!this.recording) return;
    
    // We can still push points if IsRaceOn is 0 to 'capture' the last moment, 
    // but usually we only want active driving data.
    if (d.IsRaceOn !== 1) return; 
    
    // Distance-based sampling: only record if moved at least 2 meters
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const distSq = Math.pow(d.PositionX - last.x, 2) + Math.pow(d.PositionY - last.y, 2) + Math.pow(d.PositionZ - last.z, 2);
      if (distSq < 4) return; // 2^2 = 4 meters squared
    }

    const p = {
      x: d.PositionX,
      y: d.PositionY,
      z: d.PositionZ,
      speed: d.Speed * 3.6,
      drivingLine: d.NormalizedDrivingLine,
      brakeDiff: d.NormalizedAIBrakeDifference
    };

    if (this.points.length >= MAX_POINTS) {
      this.points.shift();
      // If we shift, bounds might need full recalculation occasionally,
      // but for simplicity we'll just keep expanding them or reset on clear.
    }
    this.points.push(p);

    // Update bounds incrementally
    if (p.x < this.minX) this.minX = p.x; if (p.x > this.maxX) this.maxX = p.x;
    if (p.y < this.minY) this.minY = p.y; if (p.y > this.maxY) this.maxY = p.y;
    if (p.z < this.minZ) this.minZ = p.z; if (p.z > this.maxZ) this.maxZ = p.z;
    if (p.speed > this.maxSpd) this.maxSpd = p.speed;

    this.dirty = true;
    this.updateCount();
  }

  private resetBounds(): void {
    this.minX = this.minY = this.minZ = Infinity;
    this.maxX = this.maxY = this.maxZ = -Infinity;
    this.maxSpd = 0;
  }

  private updateCount(): void {
    const el = this.container.querySelector<HTMLElement>("#rm-count");
    if (el) el.textContent = `${this.points.length.toLocaleString()} \u70b9`;
  }

  private scheduleRender(): void {
    this.animId = requestAnimationFrame(() => {
      if (this.dirty) {
        this.show3D ? this.render3D() : this.render2D();
        this.dirty = false;
      }
      this.scheduleRender();
    });
  }

  private getColor(p: Point3D): string {
    if (this.colorMode === "drivingLine") {
      // Sensitivity: 127 is max deviation. 
      // We'll use 80 as a 'full red' threshold for better contrast.
      const dev = Math.min(Math.abs(p.drivingLine) / 80, 1);
      // Hue: 240 (Blue) -> 0 (Red)
      return `hsl(${Math.round(240 - dev * 240)}, 100%, 50%)`;
    } else if (this.colorMode === "brakeDiff") {
      const dev = Math.abs(p.brakeDiff) / 127;
      return `hsl(${Math.round(60 * (1 - dev))}, 100%, 50%)`; 
    } else {
      const t = this.maxSpd > 0 ? p.speed / this.maxSpd : 0;
      // Blue(240) to Red(0)
      return `hsl(${Math.round(240 - t * 240)}, 100%, 50%)`;
    }
  }

  private render2D(): void {
    const ctx = this.ctx2D;
    const W = this.canvas2D.width;
    const H = this.canvas2D.height;
    const pts = this.points;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, W, H);

    if (pts.length < 2) return;

    const rangeX = this.maxX - this.minX || 1;
    const rangeZ = this.maxZ - this.minZ || 1;
    const PAD = 40;
    const baseScale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeZ);
    const sc = baseScale * this.scale2D;
    const ox = W / 2 - ((this.minX + this.maxX) / 2) * sc + this.pan2D.x;
    const oy = H / 2 + ((this.minZ + this.maxZ) / 2) * sc + this.pan2D.y;

    const toScreen = (x: number, z: number): [number, number] => [ox + x * sc, oy - z * sc];

    ctx.lineWidth = Math.max(2, 3 * this.scale2D);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const step = pts.length > 20000 ? Math.floor(pts.length / 20000) : 1;

    let lastDrawX = -9999;
    let lastDrawY = -9999;

    for (let i = step; i < pts.length; i += step) {
      const [ax, ay] = toScreen(pts[i - step].x, pts[i - step].z);
      const [bx, by] = toScreen(pts[i].x, pts[i].z);
      
      // Only skip if the new point is too close to the last DRAWN point
      if (step === 1 && Math.abs(lastDrawX - bx) < 1 && Math.abs(lastDrawY - by) < 1 && i !== pts.length - 1) {
        continue;
      }

      ctx.strokeStyle = this.getColor(pts[i]);
      ctx.beginPath();
      ctx.moveTo(lastDrawX === -9999 ? ax : lastDrawX, lastDrawY === -9999 ? ay : lastDrawY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      lastDrawX = bx;
      lastDrawY = by;
    }
  }

  private render3D(): void {
    const ctx = this.ctx3D;
    const W = this.canvas3D.width;
    const H = this.canvas3D.height;
    const pts = this.points;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, W, H);

    if (pts.length < 2) return;

    const cx = (this.minX + this.maxX) / 2;
    const cy = (this.minY + this.maxY) / 2;
    const cz = (this.minZ + this.maxZ) / 2;
    const span = Math.max(this.maxX - this.minX, this.maxY - this.minY, this.maxZ - this.minZ) || 1;
    const pxPerUnit = ((Math.min(W, H) * 0.8) / span) * this.scale3D;

    const rxR = (this.rotX * Math.PI) / 180;
    const ryR = (this.rotY * Math.PI) / 180;
    const cosY = Math.cos(ryR), sinY = Math.sin(ryR);
    const cosX = Math.cos(rxR), sinX = Math.sin(rxR);

    const project = (px: number, py: number, pz: number): [number, number] => {
      let x = px - cx, y = py - cy, z = pz - cz;
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      return [W / 2 + x1 * pxPerUnit, H / 2 - y1 * pxPerUnit];
    };

    // Draw Grid and Axes
    ctx.lineWidth = 1;
    const gridStep = span / 10;
    const startX = Math.floor(this.minX / gridStep) * gridStep;
    const startZ = Math.floor(this.minZ / gridStep) * gridStep;
    const endX = Math.ceil(this.maxX / gridStep) * gridStep;
    const endZ = Math.ceil(this.maxZ / gridStep) * gridStep;
    
    // Draw Grid Lines on the XZ plane at minY
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridStep) {
      const [ax, ay] = project(x, this.minY, startZ);
      const [bx, by] = project(x, this.minY, endZ);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    for (let z = startZ; z <= endZ; z += gridStep) {
      const [ax, ay] = project(startX, this.minY, z);
      const [bx, by] = project(endX, this.minY, z);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();

    // Draw Axes (Origin is relative to current map bounds for visibility, or world origin if in bounds)
    // We'll draw axes starting from the center of the bottom grid
    const [oX, oY] = project(cx, this.minY, cz);
    const axisLen = span / 2;
    
    // X Axis - Red
    ctx.strokeStyle = "rgba(255, 60, 60, 0.5)";
    ctx.beginPath(); ctx.moveTo(oX, oY); 
    const [xx, xy] = project(cx + axisLen, this.minY, cz);
    ctx.lineTo(xx, xy); ctx.stroke();
    
    // Y Axis - Green
    ctx.strokeStyle = "rgba(60, 255, 60, 0.5)";
    ctx.beginPath(); ctx.moveTo(oX, oY); 
    const [yx, yy] = project(cx, this.minY + axisLen, cz);
    ctx.lineTo(yx, yy); ctx.stroke();
    
    // Z Axis - Blue
    ctx.strokeStyle = "rgba(60, 60, 255, 0.5)";
    ctx.beginPath(); ctx.moveTo(oX, oY); 
    const [zx, zy] = project(cx, this.minY, cz + axisLen);
    ctx.lineTo(zx, zy); ctx.stroke();

    // Draw Route Points
    ctx.lineWidth = Math.max(1.5, 2 * this.scale3D);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const step = pts.length > 15000 ? Math.floor(pts.length / 15000) : 1;

    let lastDrawX = -9999;
    let lastDrawY = -9999;

    for (let i = step; i < pts.length; i += step) {
      const [ax, ay] = project(pts[i - step].x, pts[i - step].y, pts[i - step].z);
      const [bx, by] = project(pts[i].x, pts[i].y, pts[i].z);

      if (step === 1 && Math.abs(lastDrawX - bx) < 1 && Math.abs(lastDrawY - by) < 1 && i !== pts.length - 1) {
        continue;
      }

      ctx.strokeStyle = this.getColor(pts[i]);
      ctx.beginPath();
      ctx.moveTo(lastDrawX === -9999 ? ax : lastDrawX, lastDrawY === -9999 ? ay : lastDrawY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      lastDrawX = bx;
      lastDrawY = by;
    }
  }

  destroy() {
    cancelAnimationFrame(this.animId);
  }
}
