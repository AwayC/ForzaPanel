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
  label: string;
  color: string;
  unit: string;
}

class LineChart {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private series: { opts: SeriesOpts; buf: RingBuffer }[] = [];
  private animId = 0;
  private dirty = false;

  constructor(container: HTMLElement, title: string, seriesList: SeriesOpts[]) {
    container.innerHTML = `
      <div class="chart-title">${title}</div>
      <canvas class="chart-canvas"></canvas>`;

    this.canvas = container.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    this.series = seriesList.map((opts) => ({
      opts,
      buf: new RingBuffer(MAX_POINTS),
    }));
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.scheduleRender();
  }

  private resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = rect.width || 400;
    this.canvas.height = 140;
    this.dirty = true;
  }

  push(values: number[]) {
    values.forEach((v, i) => this.series[i]?.buf.push(v));
    this.dirty = true;
  }

  private scheduleRender() {
    this.animId = requestAnimationFrame(() => {
      if (this.dirty) {
        this.render();
        this.dirty = false;
      }
      this.scheduleRender();
    });
  }

  private render() {
    const { ctx, canvas } = this;
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 背景
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);

    // 找全局 min/max（多系列共享坐标）
    let allMin = Infinity,
      allMax = -Infinity;
    const dataArrays = this.series.map((s) => s.buf.toArray());
    dataArrays.forEach((arr) => {
      arr.forEach((v) => {
        if (v < allMin) allMin = v;
        if (v > allMax) allMax = v;
      });
    });
    if (!isFinite(allMin) || allMin === allMax) {
      allMin = 0;
      allMax = 1;
    }
    const range = allMax - allMin;

    // 网格线
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((t) => {
      const y = H - t * H + 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    });

    // 标尺
    ctx.fillStyle = "#555";
    ctx.font = "10px monospace";
    ctx.fillText(allMax.toFixed(0), 4, 12);
    ctx.fillText(allMin.toFixed(0), 4, H - 4);

    // 每条折线
    this.series.forEach((s, si) => {
      const arr = dataArrays[si];
      if (arr.length < 2) return;
      ctx.strokeStyle = s.opts.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      arr.forEach((v, i) => {
        const x = (i / (arr.length - 1)) * W;
        const y = H - ((v - allMin) / range) * (H - 4) - 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 图例
      const last = arr[arr.length - 1];
      ctx.fillStyle = s.opts.color;
      ctx.fillText(
        `${s.opts.label}: ${last.toFixed(1)} ${s.opts.unit}`,
        4 + si * 140,
        26,
      );
    });
  }

  destroy() {
    cancelAnimationFrame(this.animId);
  }
}

// ── 图表面板 ──────────────────────────────────────────────────────────────────

export class Charts {
  private speed: LineChart;
  private rpm: LineChart;
  private gforce: LineChart;
  private pedals: LineChart;

  constructor(container: HTMLElement) {
    container.innerHTML = `
      <div class="charts-grid">
        <div id="ch-speed"  class="chart-box"></div>
        <div id="ch-rpm"    class="chart-box"></div>
        <div id="ch-gforce" class="chart-box"></div>
        <div id="ch-pedals" class="chart-box"></div>
      </div>`;

    this.speed = new LineChart(container.querySelector("#ch-speed")!, "速度", [
      { label: "Speed", color: "#00c8ff", unit: "km/h" },
    ]);
    this.rpm = new LineChart(container.querySelector("#ch-rpm")!, "转速", [
      { label: "RPM", color: "#ffd600", unit: "rpm" },
    ]);
    this.gforce = new LineChart(container.querySelector("#ch-gforce")!, "G力", [
      { label: "纵向", color: "#00e676", unit: "g" },
      { label: "侧向", color: "#ff4081", unit: "g" },
    ]);
    this.pedals = new LineChart(
      container.querySelector("#ch-pedals")!,
      "踏板",
      [
        { label: "油门", color: "#00e676", unit: "%" },
        { label: "刹车", color: "#ff1744", unit: "%" },
      ],
    );
  }

  push(d: TelemetryData) {
    const G = 9.81;
    this.speed.push([d.Speed * 3.6]);
    this.rpm.push([d.CurrentEngineRpm]);
    this.gforce.push([d.AccelerationX / G, d.AccelerationY / G]);
    this.pedals.push([(d.Accel / 255) * 100, (d.Brake / 255) * 100]);
  }
}
