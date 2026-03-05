import type { TelemetryData } from "../types/telemetry";

const MAX_POINTS = 600; // ~60s @ ~10fps

// ── 环形缓冲 ──────────────────────────────────────────────────────────────────

class RingBuffer {
  private buf: number[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buf = new Array<number>(capacity).fill(0);
  }

  push(v: number) {
    this.buf[this.head] = v;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  toArray(): number[] {
    if (this.count < this.capacity) return this.buf.slice(0, this.count);
    const tail = this.head;
    return [...this.buf.slice(tail), ...this.buf.slice(0, tail)];
  }

  get length() {
    return this.count;
  }
}

// ── 单个折线图 ────────────────────────────────────────────────────────────────

interface SeriesOpts {
  id: string;
  label: string;
  color: string;
  unit: string;
}

class LineChart {
  public canvas: HTMLCanvasElement;
  public element: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private series: { opts: SeriesOpts; buf: RingBuffer; active: boolean }[] = [];
  private animId = 0;
  private dirty = false;
  private isIntegrated: boolean;
  private ro: ResizeObserver;

  constructor(container: HTMLElement, title: string, seriesList: SeriesOpts[], isIntegrated = false) {
    this.element = container;
    this.isIntegrated = isIntegrated;
    
    // Use position absolute for canvas so it can be resized by the observer without pushing parent bounds
    container.innerHTML = `
      ${title ? `<div class="chart-title" style="font-size: 14px; font-weight: bold; color: var(--muted); padding: 12px 16px; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border);">${title}</div>` : ''}
      <div style="flex:1; position:relative; min-height:0;">
        <canvas class="chart-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; display:block;"></canvas>
      </div>`;

    this.canvas = container.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    this.series = seriesList.map((opts) => ({
      opts,
      buf: new RingBuffer(MAX_POINTS),
      active: true,
    }));
    
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas.parentElement!);

    this.scheduleRender();
  }

  private resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
  }

  push(values: Record<string, number>) {
    for (const s of this.series) {
      if (values[s.opts.id] !== undefined) {
        s.buf.push(values[s.opts.id]);
      }
    }
    this.dirty = true;
  }

  setActiveSeries(activeIds: string[]) {
    this.series.forEach(s => {
      s.active = activeIds.includes(s.opts.id) || activeIds.some(id => s.opts.id.startsWith(id));
    });
    this.dirty = true;
  }

  private scheduleRender() {
    this.animId = requestAnimationFrame(() => {
      if (this.dirty && this.element.style.display !== "none") {
        this.render();
        this.dirty = false;
      }
      this.scheduleRender();
    });
  }

  private render() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;
    
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, W, H);

    const activeSeries = this.series.filter(s => s.active);
    if (activeSeries.length === 0) return;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((t) => {
      const y = H - t * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    });

    const getMinMax = (s: typeof this.series[0]) => {
      const arr = s.buf.toArray();
      let min = Infinity, max = -Infinity;
      for (const v of arr) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (!isFinite(min) || min === max) { min = 0; max = Math.max(1, max * 2); }
      return { min, max, arr };
    };

    let globalMin = Infinity, globalMax = -Infinity;
    if (!this.isIntegrated) {
      activeSeries.forEach(s => {
        const { min, max } = getMinMax(s);
        if (min < globalMin) globalMin = min;
        if (max > globalMax) globalMax = max;
      });
      if (!isFinite(globalMin) || globalMin === globalMax) { globalMin = 0; globalMax = 1; }
    }

    ctx.font = "14px monospace";
    ctx.textBaseline = "middle";

    let legendX = 10;
    const legendY = 20;

    activeSeries.forEach((s) => {
      const { min, max, arr } = getMinMax(s);
      if (arr.length < 2) return;

      const drawMin = this.isIntegrated ? min : globalMin;
      const drawMax = this.isIntegrated ? max : globalMax;
      const range = drawMax - drawMin || 1;

      ctx.strokeStyle = s.opts.color;
      ctx.lineWidth = 2.5; 
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      
      for (let i = 0; i < arr.length; i++) {
        const x = (i / (arr.length - 1)) * W;
        // Padding top and bottom for line
        const y = H - ((arr[i] - drawMin) / range) * (H - 40) - 10;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      const last = arr[arr.length - 1] ?? 0;
      ctx.fillStyle = s.opts.color;
      const text = `${s.opts.label}: ${last.toFixed(1)} ${s.opts.unit}`;
      ctx.fillText(text, legendX, legendY);
      legendX += ctx.measureText(text).width + 20;
    });
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.animId);
  }
}

// ── 图表面板 ──────────────────────────────────────────────────────────────────

export class Charts {
  private speed!: LineChart;
  private rpm!: LineChart;
  private gforce!: LineChart;
  private pedals!: LineChart;
  private integratedChart!: LineChart;

  private root: HTMLElement;
  private showSpeed = true;
  private showRpm = true;
  private showGforce = true;
  private showPedals = true;
  private useIntegrated = false;

  constructor(container: HTMLElement) {
    this.root = container;
    this.buildHTML();
    this.initCharts();
    this.bindEvents();
    this.updateLayout();
  }

  private buildHTML() {
    this.root.innerHTML = `
      <div style="display:flex; flex-direction:column; height: 100%; width: 100%;">
        <div class="charts-toolbar" style="display:flex; flex-wrap:wrap; gap:16px; padding: 12px 20px; background: var(--surface); border-bottom: 1px solid var(--border); align-items: center; flex-shrink: 0;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;"><input type="checkbox" id="cb-speed" checked> 速度</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;"><input type="checkbox" id="cb-rpm" checked> 转速</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;"><input type="checkbox" id="cb-gforce" checked> G力</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600;"><input type="checkbox" id="cb-pedals" checked> 踏板</label>
          <div style="width: 1px; height: 20px; background: var(--border); margin: 0 8px;"></div>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:14px; font-weight:600; color: var(--accent);"><input type="checkbox" id="cb-integrated"> 整合显示</label>
        </div>
        <div id="charts-container" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
          <div id="charts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; padding: 20px; overflow-y:auto; flex:1;">
            <div id="ch-speed" class="chart-box" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; min-height: 250px;"></div>
            <div id="ch-rpm" class="chart-box" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; min-height: 250px;"></div>
            <div id="ch-gforce" class="chart-box" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; min-height: 250px;"></div>
            <div id="ch-pedals" class="chart-box" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden; min-height: 250px;"></div>
          </div>
          <div id="ch-integrated" style="display:none; flex:1; padding: 20px; overflow:hidden; flex-direction:column;">
            <div style="background:var(--surface); border:1px solid var(--border); border-radius:10px; width: 100%; height: 100%; display:flex; flex-direction:column; overflow:hidden;" id="ch-integrated-box"></div>
          </div>
        </div>
      </div>
    `;
  }

  private initCharts() {
    this.speed = new LineChart(this.root.querySelector("#ch-speed")!, "速度 (Speed)", [
      { id: "speed", label: "Speed", color: "#00c8ff", unit: "km/h" },
    ]);
    this.rpm = new LineChart(this.root.querySelector("#ch-rpm")!, "转速 (RPM)", [
      { id: "rpm", label: "RPM", color: "#ffd600", unit: "rpm" },
    ]);
    this.gforce = new LineChart(this.root.querySelector("#ch-gforce")!, "G力 (G-Force)", [
      { id: "gforce_x", label: "纵向(Long)", color: "#00e676", unit: "g" },
      { id: "gforce_y", label: "侧向(Lat)", color: "#ff4081", unit: "g" },
    ]);
    this.pedals = new LineChart(this.root.querySelector("#ch-pedals")!, "踏板 (Pedals)", [
      { id: "accel", label: "油门(Thr)", color: "#00e676", unit: "%" },
      { id: "brake", label: "刹车(Brk)", color: "#ff1744", unit: "%" },
      { id: "clutch", label: "离合(Clu)", color: "#ffea00", unit: "%" },
      { id: "handbrake", label: "手刹(HB)", color: "#b388ff", unit: "%" },
    ]);

    this.integratedChart = new LineChart(this.root.querySelector("#ch-integrated-box")!, "", [
      { id: "speed", label: "Speed", color: "#00c8ff", unit: "km/h" },
      { id: "rpm", label: "RPM", color: "#ffd600", unit: "rpm" },
      { id: "gforce_x", label: "G纵向", color: "#00e676", unit: "g" },
      { id: "gforce_y", label: "G侧向", color: "#ff4081", unit: "g" },
      { id: "accel", label: "油门", color: "#00e676", unit: "%" },
      { id: "brake", label: "刹车", color: "#ff1744", unit: "%" },
      { id: "clutch", label: "离合", color: "#ffea00", unit: "%" },
      { id: "handbrake", label: "手刹", color: "#b388ff", unit: "%" },
    ], true);
  }

  private bindEvents() {
    const bindCb = (id: string, prop: keyof this) => {
      this.root.querySelector(`#${id}`)!.addEventListener("change", (e) => {
        (this as any)[prop] = (e.target as HTMLInputElement).checked;
        this.updateLayout();
      });
    };
    bindCb("cb-speed", "showSpeed");
    bindCb("cb-rpm", "showRpm");
    bindCb("cb-gforce", "showGforce");
    bindCb("cb-pedals", "showPedals");
    bindCb("cb-integrated", "useIntegrated");
  }

  private updateLayout() {
    const grid = this.root.querySelector("#charts-grid") as HTMLElement;
    const integ = this.root.querySelector("#ch-integrated") as HTMLElement;

    if (this.useIntegrated) {
      grid.style.display = "none";
      integ.style.display = "block";
      
      const activeIds: string[] = [];
      if (this.showSpeed) activeIds.push("speed");
      if (this.showRpm) activeIds.push("rpm");
      if (this.showGforce) activeIds.push("gforce_x", "gforce_y");
      if (this.showPedals) activeIds.push("accel", "brake", "clutch", "handbrake");
      
      this.integratedChart.setActiveSeries(activeIds);
      // Force a resize in case the container size changed
      window.dispatchEvent(new Event("resize"));
    } else {
      grid.style.display = "grid";
      integ.style.display = "none";
      
      this.speed.element.style.display = this.showSpeed ? "flex" : "none";
      this.rpm.element.style.display = this.showRpm ? "flex" : "none";
      this.gforce.element.style.display = this.showGforce ? "flex" : "none";
      this.pedals.element.style.display = this.showPedals ? "flex" : "none";
    }
  }

  push(d: TelemetryData) {
    const G = 9.81;
    const vals = {
      speed: d.Speed ? d.Speed * 3.6 : 0,
      rpm: d.CurrentEngineRpm || 0,
      gforce_x: d.AccelerationX ? d.AccelerationX / G : 0,
      gforce_y: d.AccelerationY ? d.AccelerationY / G : 0,
      accel: d.Accel ? (d.Accel / 255) * 100 : 0,
      brake: d.Brake ? (d.Brake / 255) * 100 : 0,
      clutch: d.Clutch ? (d.Clutch / 255) * 100 : 0,
      handbrake: d.HandBrake ? (d.HandBrake / 255) * 100 : 0,
    };
    
    if (this.useIntegrated) {
      this.integratedChart.push(vals);
    } else {
      this.speed.push(vals);
      this.rpm.push(vals);
      this.gforce.push(vals);
      this.pedals.push(vals);
    }
  }
}
