import type { TelemetryData } from "../types/telemetry";

const MAX_POINTS = 100_000;

interface Point3D {
  x: number;
  y: number;
  z: number;
  speed: number;
  drivingLine: number; // NormalizedDrivingLine: -127~+127，0=理想赛线
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
  private colorMode: "speed" | "drivingLine" = "speed";
  private lastIsRaceOn = 0;

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
      const w =
        r.width > 10
          ? r.width
          : wrap.offsetWidth || window.innerWidth - 40 || 800;
      const h =
        r.height > 10
          ? r.height
          : wrap.offsetHeight || Math.max(420, window.innerHeight - 180);
      if (this.canvas2D.width === w && this.canvas2D.height === h) return;
      this.canvas2D.width = w;
      this.canvas2D.height = h;
      this.canvas3D.width = w;
      this.canvas3D.height = h;
      this.dirty = true;
    };
    this._resize();
    window.addEventListener("resize", this._resize);

    // Re-size when the canvas container actually gets layout (tab shown)
    const ro = new ResizeObserver(() => {
      this._resize();
    });
    ro.observe(wrap);
  }

  /** Call this whenever the route tab becomes visible */
  onVisible(): void {
    this._resize();
    this.dirty = true;
  }

  private _resize: () => void = () => {};

  /* ── Controls ──────────────────────────────────────────────────────────── */

  private bindControls(): void {
    const btn2D =
      this.container.querySelector<HTMLButtonElement>("#rm-2d-btn")!;
    const btn3D =
      this.container.querySelector<HTMLButtonElement>("#rm-3d-btn")!;
    const recordBtn =
      this.container.querySelector<HTMLButtonElement>("#rm-record-btn")!;
    const clearBtn =
      this.container.querySelector<HTMLButtonElement>("#rm-clear-btn")!;
    const resetBtn =
      this.container.querySelector<HTMLButtonElement>("#rm-reset-btn")!;
    const colorBtn =
      this.container.querySelector<HTMLButtonElement>("#rm-color-btn")!;
    const toggleBtn =
      this.container.querySelector<HTMLButtonElement>("#rm-toggle-btn")!;
    const wrap = this.container.querySelector<HTMLElement>(".rm-wrap")!;

    toggleBtn.addEventListener("click", () => {
      const collapsed = wrap.classList.toggle("rm-collapsed");
      toggleBtn.textContent = collapsed ? "▶ 路线地图" : "▼ 路线地图";
      toggleBtn.classList.toggle("rm-active", !collapsed);
      if (!collapsed) {
        // 展开后重新计算尺寸
        requestAnimationFrame(() => this._resize());
      }
    });

    colorBtn.addEventListener("click", () => {
      this.colorMode = this.colorMode === "speed" ? "drivingLine" : "speed";
      colorBtn.textContent =
        this.colorMode === "speed" ? "🎨 速度" : "🎯 驾驶线";
      colorBtn.classList.toggle("rm-active", true);
      this.dirty = true;
    });

    recordBtn.addEventListener("click", () => {
      this.recording = !this.recording;
      recordBtn.textContent = this.recording ? "⏺ 记录中" : "⏸ 已暂停";
      recordBtn.classList.toggle("rm-active", this.recording);
    });

    clearBtn.addEventListener("click", () => {
      this.points = [];
      this.pan2D = { x: 0, y: 0 };
      this.scale2D = 1;
      this.scale3D = 1;
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

    /* 3D — drag to rotate */
    this.canvas3D.addEventListener("mousedown", (e) => {
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });

    /* 2D — right-click drag to pan */
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

    /* Scroll zoom */
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
    this.canvas2D.addEventListener("wheel", (e) => zoomHandler(e, false), {
      passive: false,
    });
    this.canvas3D.addEventListener("wheel", (e) => zoomHandler(e, true), {
      passive: false,
    });
  }

  /* ── Data push ─────────────────────────────────────────────────────────── */

  push(d: TelemetryData): void {
    // 检测 race 开始（IsRaceOn 0→1），自动清除上一轮路线
    if (d.IsRaceOn === 1 && this.lastIsRaceOn === 0) {
      this.points = [];
      this.pan2D = { x: 0, y: 0 };
      this.scale2D = 1;
      this.scale3D = 1;
      this.updateCount();
    }
    this.lastIsRaceOn = d.IsRaceOn;

    if (!this.recording) return;
    if (d.IsRaceOn !== 1) return; // 仅在比赛中记录
    if (this.points.length >= MAX_POINTS) this.points.shift();
    this.points.push({
      x: d.PositionX,
      y: d.PositionY,
      z: d.PositionZ,
      speed: d.Speed * 3.6,
      drivingLine: d.NormalizedDrivingLine,
    });
    this.dirty = true;
    this.updateCount();
  }

  private updateCount(): void {
    const el = this.container.querySelector<HTMLElement>("#rm-count");
    if (el) el.textContent = `${this.points.length.toLocaleString()} 点`;
  }

  /* ── Render loop ───────────────────────────────────────────────────────── */

  private scheduleRender(): void {
    this.animId = requestAnimationFrame(() => {
      if (this.dirty) {
        this.show3D ? this.render3D() : this.render2D();
        this.dirty = false;
      }
      this.scheduleRender();
    });
  }

  /* ── 2D top-down ───────────────────────────────────────────────────────── */

  private render2D(): void {
    const ctx = this.ctx2D;
    const W = this.canvas2D.width;
    const H = this.canvas2D.height;
    const pts = this.points;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    if (pts.length < 2) {
      ctx.fillStyle = "#444";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("等待位置数据…", W / 2, H / 2);
      return;
    }

    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      maxSpd = 0;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
      if (p.speed > maxSpd) maxSpd = p.speed;
    }

    const PAD = 28;
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;
    const baseScale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeZ);
    const sc = baseScale * this.scale2D;
    const ox = W / 2 - ((minX + maxX) / 2) * sc + this.pan2D.x;
    const oy = H / 2 + ((minZ + maxZ) / 2) * sc + this.pan2D.y;
    const toScreen = (x: number, z: number): [number, number] => [
      ox + x * sc,
      oy - z * sc,
    ];

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridM = Math.pow(10, Math.floor(Math.log10(rangeX / 4)));
    for (let gx = Math.ceil(minX / gridM) * gridM; gx <= maxX; gx += gridM) {
      const [sx] = toScreen(gx, minZ);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }
    for (let gz = Math.ceil(minZ / gridM) * gridM; gz <= maxZ; gz += gridM) {
      const [, sy] = toScreen(minX, gz);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }

    // path (draw in segments colored by mode)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      let color: string;
      if (this.colorMode === "drivingLine") {
        // 0=理想线(绿) ±127=偏离最大(红)
        const dev = Math.abs(b.drivingLine) / 127;
        color = `hsl(${Math.round(120 * (1 - dev))},90%,52%)`;
      } else {
        const t = maxSpd > 0 ? b.speed / maxSpd : 0;
        color = `hsl(${(240 - t * 240).toFixed(0)},90%,55%)`;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const [ax, ay] = toScreen(a.x, a.z);
      const [bx, by] = toScreen(b.x, b.z);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // start marker
    const [sx, sy] = toScreen(pts[0].x, pts[0].z);
    ctx.shadowColor = "#00e676";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#00e676";
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // current position
    const last = pts[pts.length - 1];
    const [lx, ly] = toScreen(last.x, last.z);
    ctx.shadowColor = "#00c8ff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#00c8ff";
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(4, 4, 200, 38);
    ctx.fillStyle = "#888";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      `X ${minX.toFixed(0)}~${maxX.toFixed(0)}m  Z ${minZ.toFixed(0)}~${maxZ.toFixed(0)}m`,
      8,
      16,
    );
    ctx.fillText(
      `${pts.length.toLocaleString()} pts · max ${maxSpd.toFixed(0)} km/h`,
      8,
      30,
    );
    ctx.fillStyle = "#00e676";
    ctx.fillText("● 起点", W - 80, 16);
    ctx.fillStyle = "#00c8ff";
    ctx.fillText("● 当前", W - 80, 30);
    // color mode legend
    if (this.colorMode === "drivingLine") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(4, 48, 200, 14);
      ctx.fillStyle = "#00c853";
      ctx.fillText("● 理想赛线", 8, 58);
      ctx.fillStyle = "#ff5252";
      ctx.fillText("● 偏离赛线", 80, 58);
    }
  }

  /* ── 3D rotatable ──────────────────────────────────────────────────────── */

  private render3D(): void {
    const ctx = this.ctx3D;
    const W = this.canvas3D.width;
    const H = this.canvas3D.height;
    const pts = this.points;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    if (pts.length < 2) {
      ctx.fillStyle = "#444";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("等待位置数据…", W / 2, H / 2);
      return;
    }

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity,
      maxSpd = 0;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
      if (p.speed > maxSpd) maxSpd = p.speed;
    }

    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2,
      cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const pxPerUnit = ((Math.min(W, H) * 0.75) / span) * this.scale3D;

    const rxR = (this.rotX * Math.PI) / 180;
    const ryR = (this.rotY * Math.PI) / 180;
    const cosY = Math.cos(ryR),
      sinY = Math.sin(ryR);
    const cosX = Math.cos(rxR),
      sinX = Math.sin(rxR);

    const project = (px: number, py: number, pz: number): [number, number] => {
      let x = px - cx,
        y = py - cy,
        z = pz - cz;
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      return [W / 2 + x1 * pxPerUnit, H / 2 - y1 * pxPerUnit - z2 * 0]; // ortho
    };

    // grid floor at minY
    const gs = span / 4;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const [x1, y1] = project(cx + i * gs, minY, cz - span / 2);
      const [x2, y2] = project(cx + i * gs, minY, cz + span / 2);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = project(cx - span / 2, minY, cz + i * gs);
      const [x4, y4] = project(cx + span / 2, minY, cz + i * gs);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    // axes
    const axLen = span * 0.25;
    const drawAxis = (
      tx: number,
      ty: number,
      tz: number,
      color: string,
      label: string,
    ) => {
      const [ox, oy] = project(cx, cy, cz);
      const [ex, ey] = project(
        cx + tx * axLen,
        cy + ty * axLen,
        cz + tz * axLen,
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, ex + (ex - ox) * 0.15, ey + (ey - oy) * 0.15);
    };
    drawAxis(1, 0, 0, "rgba(255,80,80,0.7)", "X");
    drawAxis(0, 1, 0, "rgba(80,255,80,0.7)", "Y");
    drawAxis(0, 0, 1, "rgba(80,160,255,0.7)", "Z");

    // path
    ctx.lineWidth = 1.8;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      const t = maxSpd > 0 ? b.speed / maxSpd : 0;
      ctx.strokeStyle = `hsl(${(240 - t * 240).toFixed(0)},90%,55%)`;
      const [ax, ay] = project(a.x, a.y, a.z);
      const [bx, by] = project(b.x, b.y, b.z);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // start
    const [sx, sy] = project(pts[0].x, pts[0].y, pts[0].z);
    ctx.shadowColor = "#00e676";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#00e676";
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // current
    const last = pts[pts.length - 1];
    const [lx, ly] = project(last.x, last.y, last.z);
    ctx.shadowColor = "#00c8ff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#00c8ff";
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // speed legend gradient
    const lgW = 100,
      lgH = 8,
      lgX = W - lgW - 8,
      lgY = H - 20;
    const grad = ctx.createLinearGradient(lgX, 0, lgX + lgW, 0);
    grad.addColorStop(0, "hsl(240,90%,55%)");
    grad.addColorStop(0.5, "hsl(120,90%,55%)");
    grad.addColorStop(1, "hsl(0,90%,55%)");
    ctx.fillStyle = grad;
    ctx.fillRect(lgX, lgY, lgW, lgH);
    ctx.fillStyle = "#888";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("慢", lgX, lgY - 2);
    ctx.fillText("快", lgX + lgW, lgY - 2);

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(4, 4, 210, 26);
    ctx.fillStyle = "#888";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      `旋转 X:${this.rotX.toFixed(0)}° Y:${this.rotY.toFixed(0)}°  ${pts.length.toLocaleString()} pts`,
      8,
      18,
    );
  }

  destroy() {
    cancelAnimationFrame(this.animId);
  }
}
