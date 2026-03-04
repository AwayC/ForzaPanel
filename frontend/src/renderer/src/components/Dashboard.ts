import type { TelemetryData } from "../types/telemetry";
import { CAR_CLASS, DRIVETRAIN } from "../types/telemetry";

// ── helpers ───────────────────────────────────────────────────────────────────

function f(n: number, d = 0): string {
  return n.toFixed(d);
}
function pct255(n: number): string {
  return ((n / 255) * 100).toFixed(0) + "%";
}
function pct1(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
function lapTime(sec: number): string {
  if (sec <= 0) return "--:--.---";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
function kw(w: number): string {
  return (w / 1000).toFixed(1);
}
function sign(n: number): string {
  return n >= 0 ? "+" + f(n, 2) : f(n, 2);
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Panel {
  id: string;
  title: string;
  build: () => string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export class Dashboard {
  private root: HTMLElement;
  private hidden: Set<string>;
  private menuOpen = false;
  private gCanvas: HTMLCanvasElement | null = null;
  private gCtx: CanvasRenderingContext2D | null = null;
  private gYCanvas: HTMLCanvasElement | null = null;
  private gYCtx: CanvasRenderingContext2D | null = null;
  private gLatest = { gx: 0, gy: 0, gz: 0 };

  constructor(container: HTMLElement) {
    this.hidden = new Set(
      JSON.parse(localStorage.getItem("hiddenPanels") ?? "[]") as string[],
    );
    this.root = container;
    this.render();
  }

  /* ── render ─────────────────────────────────────────────────────────────── */

  private render(): void {
    const panels = this.allPanels();
    this.root.innerHTML = `
      <div class="panel-toolbar">
        <button class="panel-toggle-btn" id="panel-menu-btn">\u2699 \u9762\u677f</button>
        <div class="panel-menu" id="panel-menu" style="display:none">
          ${panels
            .map(
              (p) => `
            <label class="panel-check">
              <input type="checkbox" data-panel="${p.id}" ${this.hidden.has(p.id) ? "" : "checked"}/>
              ${p.title}
            </label>`,
            )
            .join("")}
        </div>
      </div>
      <div class="dashboard">
        ${panels
          .map(
            (p) => `
          <div class="card" id="card-${p.id}" ${this.hidden.has(p.id) ? 'style="display:none"' : ""}>
            <div class="card-title">${p.title}</div>
            ${p.build()}
          </div>`,
          )
          .join("")}
      </div>`;
    this.bindMenu();
    this.initGForceCanvas();
    this.initDrag();
  }

  private bindMenu(): void {
    const btn = this.root.querySelector<HTMLElement>("#panel-menu-btn")!;
    const menu = this.root.querySelector<HTMLElement>("#panel-menu")!;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.menuOpen = !this.menuOpen;
      menu.style.display = this.menuOpen ? "block" : "none";
    });
    document.addEventListener("click", () => {
      if (this.menuOpen) {
        this.menuOpen = false;
        menu.style.display = "none";
      }
    });
    menu
      .querySelectorAll<HTMLInputElement>("input[data-panel]")
      .forEach((cb) => {
        cb.addEventListener("change", () => {
          const id = cb.dataset.panel!;
          const card = this.root.querySelector<HTMLElement>(`#card-${id}`)!;
          if (cb.checked) {
            this.hidden.delete(id);
            card.style.display = "";
          } else {
            this.hidden.add(id);
            card.style.display = "none";
          }
          localStorage.setItem(
            "hiddenPanels",
            JSON.stringify([...this.hidden]),
          );
        });
      });
  }

  /* ── update ─────────────────────────────────────────────────────────────── */

  update(d: TelemetryData): void {
    // core
    this.t("speed", f(d.Speed * 3.6));
    this.t("rpm-val", f(d.CurrentEngineRpm));
    this.t("rpm-max", f(d.EngineMaxRpm));
    this.t("gear", d.Gear === 0 ? "N" : d.Gear === 11 ? "R" : String(d.Gear));
    const rpmPct =
      d.EngineMaxRpm > 0 ? (d.CurrentEngineRpm / d.EngineMaxRpm) * 100 : 0;
    this.w("rpm-bar", rpmPct);
    this.colorRpm("rpm-bar", rpmPct);

    // pedals
    this.t("accel-pct", pct255(d.Accel));
    this.t("brake-pct", pct255(d.Brake));
    this.t("clutch-pct", pct255(d.Clutch));
    this.t("handbrake-pct", pct255(d.HandBrake));
    this.t("steer-val", f(d.Steer));
    this.w("accel-bar", (d.Accel / 255) * 100);
    this.w("brake-bar", (d.Brake / 255) * 100);
    this.w("clutch-bar", (d.Clutch / 255) * 100);
    this.w("handbrake-bar", (d.HandBrake / 255) * 100);

    // engine
    this.t("power-kw", kw(d.Power));
    this.t("torque-nm", f(d.Torque, 1));
    this.t("boost-val", f(d.Boost, 2));
    this.t("fuel-pct", pct1(d.Fuel));
    this.t("rpm-idle", f(d.EngineIdleRpm));

    // lap
    this.t("lap-num", String(d.LapNumber));
    this.t("race-pos", String(d.RacePosition));
    this.t("race-time", lapTime(d.CurrentRaceTime));
    this.t("cur-lap", lapTime(d.CurrentLap));
    this.t("last-lap", lapTime(d.LastLap));
    this.t("best-lap", lapTime(d.BestLap));
    this.t("dist", f(d.DistanceTraveled / 1000, 2) + " km");

    // tire temp
    this.t("tt-fl", f(d.TireTempFL));
    this.tireTemp("tt-fl", d.TireTempFL);
    this.t("tt-fr", f(d.TireTempFR));
    this.tireTemp("tt-fr", d.TireTempFR);
    this.t("tt-rl", f(d.TireTempRL));
    this.tireTemp("tt-rl", d.TireTempRL);
    this.t("tt-rr", f(d.TireTempRR));
    this.tireTemp("tt-rr", d.TireTempRR);

    // tire detail
    this.t("sr-fl", f(d.TireSlipRatioFL, 3));
    this.t("sr-fr", f(d.TireSlipRatioFR, 3));
    this.t("sr-rl", f(d.TireSlipRatioRL, 3));
    this.t("sr-rr", f(d.TireSlipRatioRR, 3));
    this.tireVBar("sa-fl", Math.abs(d.TireSlipAngleFL));
    this.tireVBar("sa-fr", Math.abs(d.TireSlipAngleFR));
    this.tireVBar("sa-rl", Math.abs(d.TireSlipAngleRL));
    this.tireVBar("sa-rr", Math.abs(d.TireSlipAngleRR));
    this.tireVBar("cs-fl", d.TireCombinedSlipFL);
    this.tireVBar("cs-fr", d.TireCombinedSlipFR);
    this.tireVBar("cs-rl", d.TireCombinedSlipRL);
    this.tireVBar("cs-rr", d.TireCombinedSlipRR);
    if (d.TireWearFL > 0 || d.TireWearFR > 0) {
      this.t("tw-fl", pct1(d.TireWearFL));
      this.t("tw-fr", pct1(d.TireWearFR));
      this.t("tw-rl", pct1(d.TireWearRL));
      this.t("tw-rr", pct1(d.TireWearRR));
    }

    // suspension
    this.t("susp-fl", f(d.NormalizedSuspensionTravelFL, 3));
    this.t("susp-fr", f(d.NormalizedSuspensionTravelFR, 3));
    this.t("susp-rl", f(d.NormalizedSuspensionTravelRL, 3));
    this.t("susp-rr", f(d.NormalizedSuspensionTravelRR, 3));
    this.t("suspm-fl", f(d.SuspensionTravelMetersFL * 100, 1) + " cm");
    this.t("suspm-fr", f(d.SuspensionTravelMetersFR * 100, 1) + " cm");
    this.t("suspm-rl", f(d.SuspensionTravelMetersRL * 100, 1) + " cm");
    this.t("suspm-rr", f(d.SuspensionTravelMetersRR * 100, 1) + " cm");

    // wheel speed (approximate r=0.33m => rad/s * 0.33 = m/s)
    const toKmh = (rad: number): string => f(Math.abs(rad) * 0.33 * 3.6, 0);
    this.t("ws-fl", toKmh(d.WheelRotationSpeedFL));
    this.t("ws-fr", toKmh(d.WheelRotationSpeedFR));
    this.t("ws-rl", toKmh(d.WheelRotationSpeedRL));
    this.t("ws-rr", toKmh(d.WheelRotationSpeedRR));

    // G-force
    const G = 9.81;
    const gx = d.AccelerationX / G;
    const gy = d.AccelerationY / G;
    const gz = d.AccelerationZ / G;
    this.gLatest = { gx, gy, gz };
    this.t("acc-x", sign(gx));
    this.t("acc-y", sign(gy));
    this.t("acc-z", sign(gz));
    this.t("av-x", f(d.AngularVelocityX, 3));
    this.t("av-y", f(d.AngularVelocityY, 3));
    this.t("av-z", f(d.AngularVelocityZ, 3));
    this.drawGForce();
    this.drawYGauge();

    // posture
    const deg = (r: number): string => f((r * 180) / Math.PI, 1) + "\u00b0";
    this.t("yaw", deg(d.Yaw));
    this.t("pitch", deg(d.Pitch));
    this.t("roll", deg(d.Roll));

    // car info
    this.t("car-class", CAR_CLASS[d.CarClass] ?? "?");
    this.t("car-pi", String(d.CarPerformanceIndex));
    this.t("drivetrain", DRIVETRAIN[d.DrivetrainType] ?? "?");
    this.t("cylinders", String(d.NumCylinders));
    this.t("car-ordinal", String(d.CarOrdinal));
    if (d.TrackOrdinal > 0) this.t("track-ordinal", String(d.TrackOrdinal));

    // position
    this.t("pos-x", f(d.PositionX, 1));
    this.t("pos-y", f(d.PositionY, 1));
    this.t("pos-z", f(d.PositionZ, 1));
  }

  /* ── DOM helpers ────────────────────────────────────────────────────────── */

  private t(id: string, v: string): void {
    const el = this.root.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (el) el.textContent = v;
  }
  private w(id: string, pct: number): void {
    const el = this.root.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (el) el.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
  }
  private colorRpm(id: string, pct: number): void {
    const el = this.root.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!el) return;
    if (pct > 90) el.style.background = "var(--red)";
    else if (pct > 75) el.style.background = "var(--yellow)";
    else el.style.background = "var(--accent)";
  }
  private tireTemp(id: string, temp: number): void {
    const el = this.root
      .querySelector<HTMLElement>(`[data-id="${id}"]`)
      ?.closest(".tire-cell");
    if (!el) return;
    if (temp > 100) (el as HTMLElement).style.borderColor = "var(--red)";
    else if (temp > 80) (el as HTMLElement).style.borderColor = "var(--yellow)";
    else if (temp > 50) (el as HTMLElement).style.borderColor = "var(--green)";
    else (el as HTMLElement).style.borderColor = "var(--border)";
  }

  /** Vertical tire bar: 0-1 blue→yellow→red gradient, >1 full red */
  private tireVBar(id: string, val: number): void {
    const bar = this.root.querySelector<HTMLElement>(`[data-id="${id}"]`);
    const num = this.root.querySelector<HTMLElement>(`[data-id="${id}-num"]`);
    if (!bar) return;
    const clamped = Math.min(val, 1);
    const hPct = clamped * 100;
    bar.style.height = `${hPct.toFixed(1)}%`;
    if (val > 1) {
      bar.style.background = "var(--red)";
    } else {
      // 0→blue(200), 0.5→yellow(60), 1→red(0)  via HSL
      const hue = (1 - clamped) * 200;
      bar.style.background = `hsl(${hue.toFixed(0)}, 90%, 50%)`;
    }
    if (num) num.textContent = f(val, 2);
  }

  /* ── panel definitions ──────────────────────────────────────────────────── */

  private allPanels(): Panel[] {
    return [
      { id: "core", title: "\u26a1 \u6838\u5fc3", build: () => this.tplCore() },
      {
        id: "pedals",
        title: "\ud83e\uddb6 \u8e0f\u677f",
        build: () => this.tplPedals(),
      },
      {
        id: "engine",
        title: "\ud83d\udd27 \u53d1\u52a8\u673a",
        build: () => this.tplEngine(),
      },
      {
        id: "lap",
        title: "\ud83c\udfc1 \u5708\u901f",
        build: () => this.tplLap(),
      },
      {
        id: "tire-temp",
        title: "\ud83c\udf21 \u80ce\u6e29",
        build: () => this.tplTireTemp(),
      },
      {
        id: "tire-detail",
        title: "\ud83d\udef9 \u8f6e\u80ce\u8be6\u7ec6",
        build: () => this.tplTireDetail(),
      },
      {
        id: "suspension",
        title: "\ud83d\udcd0 \u60ac\u6302",
        build: () => this.tplSuspension(),
      },
      {
        id: "wheelspeed",
        title: "\ud83d\udd04 \u8f6e\u901f",
        build: () => this.tplWheelSpeed(),
      },
      {
        id: "gforce",
        title: "\ud83d\udcca G\u529b",
        build: () => this.tplGForce(),
      },
      {
        id: "posture",
        title: "\ud83c\udfaf \u8f66\u8eab\u59ff\u6001",
        build: () => this.tplPosture(),
      },
      {
        id: "carinfo",
        title: "\ud83d\ude97 \u8f66\u8f86\u4fe1\u606f",
        build: () => this.tplCarInfo(),
      },
      {
        id: "position",
        title: "\ud83d\udccd \u4f4d\u7f6e",
        build: () => this.tplPosition(),
      },
    ];
  }

  private tplCore(): string {
    return `
      <div class="core-row">
        <div class="big-block">
          <div class="label">SPEED</div>
          <div class="big-val accent"><span data-id="speed">0</span></div>
          <div class="unit">km/h</div>
        </div>
        <div class="big-block">
          <div class="label">GEAR</div>
          <div class="big-val"><span data-id="gear">N</span></div>
        </div>
      </div>
      <div class="label mt">RPM <span data-id="rpm-val">0</span> / <span data-id="rpm-max">0</span></div>
      <div class="bar-track mt4"><div class="bar" data-id="rpm-bar" style="background:var(--accent)"></div></div>`;
  }

  private tplPedals(): string {
    return `
      ${this.barRow("ACCEL", "accel-bar", "accel-pct", "var(--green)")}
      ${this.barRow("BRAKE", "brake-bar", "brake-pct", "var(--red)")}
      ${this.barRow("CLUTCH", "clutch-bar", "clutch-pct", "var(--yellow)")}
      ${this.barRow("HANDBRAKE", "handbrake-bar", "handbrake-pct", "var(--accent)")}
      <div class="kv-row mt"><span class="kv-label">STEER</span><span data-id="steer-val" class="kv-val">0</span></div>`;
  }

  private tplEngine(): string {
    return `
      <div class="kv-grid">
        ${this.kv("POWER", "power-kw", "kW")}
        ${this.kv("TORQUE", "torque-nm", "N\u00b7m")}
        ${this.kv("BOOST", "boost-val", "psi")}
        ${this.kv("FUEL", "fuel-pct", "")}
        ${this.kv("IDLE RPM", "rpm-idle", "")}
      </div>`;
  }

  private tplLap(): string {
    return `
      <div class="kv-row">
        <span class="kv-label">LAP</span><span data-id="lap-num" class="kv-val">0</span>
        <span class="kv-label ml">POS</span><span data-id="race-pos" class="kv-val">0</span>
      </div>
      <div class="kv-row mt"><span class="kv-label">RACE TIME</span><span data-id="race-time" class="kv-val mono">--:--.---</span></div>
      <div class="kv-row mt"><span class="kv-label">CURRENT</span><span data-id="cur-lap" class="kv-val mono">--:--.---</span></div>
      <div class="kv-row mt"><span class="kv-label">LAST</span><span data-id="last-lap" class="kv-val mono">--:--.---</span></div>
      <div class="kv-row mt"><span class="kv-label">BEST</span><span data-id="best-lap" class="kv-val mono accent">--:--.---</span></div>
      <div class="kv-row mt"><span class="kv-label">DISTANCE</span><span data-id="dist" class="kv-val">0 km</span></div>`;
  }

  private tplTireTemp(): string {
    return `
      <div class="label mt">\u6e29\u5ea6 (\u00b0C)</div>
      <div class="tire-grid mt4">
        ${this.tireCell("FL", "tt-fl")}${this.tireCell("FR", "tt-fr")}
        ${this.tireCell("RL", "tt-rl")}${this.tireCell("RR", "tt-rr")}
      </div>`;
  }

  private tplTireDetail(): string {
    const vbar = (id: string): string =>
      `<div class="tire-vbar-cell">
        <div class="tire-vbar-track"><div class="tire-vbar-fill" data-id="${id}"></div></div>
        <div class="tire-vbar-num" data-id="${id}-num">0</div>
      </div>`;
    return `
      <div class="tire-detail-grid">
        <div class="td-header"></div><div class="td-header">FL</div><div class="td-header">FR</div><div class="td-header">RL</div><div class="td-header">RR</div>
        <div class="td-label">滑移率</div>
        <span data-id="sr-fl" class="td-val">0</span><span data-id="sr-fr" class="td-val">0</span><span data-id="sr-rl" class="td-val">0</span><span data-id="sr-rr" class="td-val">0</span>
        <div class="td-label">磨损%</div>
        <span data-id="tw-fl" class="td-val">-</span><span data-id="tw-fr" class="td-val">-</span><span data-id="tw-rl" class="td-val">-</span><span data-id="tw-rr" class="td-val">-</span>
      </div>
      <div class="tire-vbar-section">
        <div class="tire-vbar-group">
          <div class="tire-vbar-title">滑移角 TireSlipAngle</div>
          <div class="tire-vbar-row">
            <div class="tire-vbar-label">FL</div>${vbar("sa-fl")}
            <div class="tire-vbar-label">FR</div>${vbar("sa-fr")}
            <div class="tire-vbar-label">RL</div>${vbar("sa-rl")}
            <div class="tire-vbar-label">RR</div>${vbar("sa-rr")}
          </div>
        </div>
        <div class="tire-vbar-group">
          <div class="tire-vbar-title">综合滑移 TireCombinedSlip</div>
          <div class="tire-vbar-row">
            <div class="tire-vbar-label">FL</div>${vbar("cs-fl")}
            <div class="tire-vbar-label">FR</div>${vbar("cs-fr")}
            <div class="tire-vbar-label">RL</div>${vbar("cs-rl")}
            <div class="tire-vbar-label">RR</div>${vbar("cs-rr")}
          </div>
        </div>
      </div>`;
  }

  private tplSuspension(): string {
    return `
      <div class="tire-detail-grid">
        <div class="td-header"></div><div class="td-header">FL</div><div class="td-header">FR</div><div class="td-header">RL</div><div class="td-header">RR</div>
        <div class="td-label">\u5f52\u4e00\u5316</div>
        <span data-id="susp-fl" class="td-val">0</span><span data-id="susp-fr" class="td-val">0</span><span data-id="susp-rl" class="td-val">0</span><span data-id="susp-rr" class="td-val">0</span>
        <div class="td-label">\u884c\u7a0b</div>
        <span data-id="suspm-fl" class="td-val">0</span><span data-id="suspm-fr" class="td-val">0</span><span data-id="suspm-rl" class="td-val">0</span><span data-id="suspm-rr" class="td-val">0</span>
      </div>`;
  }

  private tplWheelSpeed(): string {
    return `
      <div class="tire-detail-grid">
        <div class="td-header"></div><div class="td-header">FL</div><div class="td-header">FR</div><div class="td-header">RL</div><div class="td-header">RR</div>
        <div class="td-label">km/h</div>
        <span data-id="ws-fl" class="td-val">0</span><span data-id="ws-fr" class="td-val">0</span><span data-id="ws-rl" class="td-val">0</span><span data-id="ws-rr" class="td-val">0</span>
      </div>`;
  }

  private tplGForce(): string {
    return `
      <div class="gforce-panel">
        <div class="gforce-plot-wrap">
          <canvas id="gforce-canvas" width="180" height="180"></canvas>
          <canvas id="gforce-y-gauge" width="30" height="180"></canvas>
        </div>
        <div class="gforce-vals">
          ${this.kv("\u5076\u5411 G (X)", "acc-x", "g")}
          ${this.kv("\u7eb5\u5411 G (Z)", "acc-z", "g")}
          ${this.kv("\u5782\u76f4 G (Y)", "acc-y", "g")}
          ${this.kv("\u89d2\u901f X", "av-x", "rad/s")}
          ${this.kv("\u89d2\u901f Y", "av-y", "rad/s")}
          ${this.kv("\u89d2\u901f Z", "av-z", "rad/s")}
        </div>
      </div>`;
  }

  private tplPosture(): string {
    return `
      <div class="kv-grid">
        ${this.kv("YAW (\u504f\u822a)", "yaw", "")}
        ${this.kv("PITCH (\u4ff0\u4ef0)", "pitch", "")}
        ${this.kv("ROLL (\u4fa7\u503e)", "roll", "")}
      </div>`;
  }

  private tplCarInfo(): string {
    return `
      <div class="kv-grid">
        ${this.kv("CLASS", "car-class", "")}
        ${this.kv("PI", "car-pi", "")}
        ${this.kv("\u9a71\u52a8", "drivetrain", "")}
        ${this.kv("\u6c14\u7f38\u6570", "cylinders", "")}
        ${this.kv("Car ID", "car-ordinal", "")}
        ${this.kv("Track ID", "track-ordinal", "")}
      </div>`;
  }

  private tplPosition(): string {
    return `
      <div class="kv-grid">
        ${this.kv("X", "pos-x", "m")}
        ${this.kv("Y", "pos-y", "m")}
        ${this.kv("Z", "pos-z", "m")}
      </div>`;
  }

  /* ── micro-templates ────────────────────────────────────────────────────── */

  private barRow(
    label: string,
    barId: string,
    textId: string,
    color: string,
  ): string {
    return `
      <div class="kv-row mt"><span class="kv-label">${label}</span><span data-id="${textId}" class="kv-val">0%</span></div>
      <div class="bar-track mt4"><div class="bar" data-id="${barId}" style="background:${color}"></div></div>`;
  }

  private kv(label: string, id: string, unit: string): string {
    return `<div class="kv-item">
      <div class="kv-label">${label}</div>
      <div class="kv-val"><span data-id="${id}">-</span><span class="unit"> ${unit}</span></div>
    </div>`;
  }

  private tireCell(pos: string, id: string): string {
    return `<div class="tire-cell">
      <span class="tire-label">${pos}</span>
      <span data-id="${id}">--</span>
    </div>`;
  }

  /* ── G-Force canvas ─────────────────────────────────────────────────────── */

  private initGForceCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    // main XZ canvas
    const c = this.root.querySelector<HTMLCanvasElement>("#gforce-canvas");
    if (c) {
      const size = 180;
      c.width = size * dpr;
      c.height = size * dpr;
      c.style.width = size + "px";
      c.style.height = size + "px";
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      this.gCanvas = c;
      this.gCtx = ctx;
    }
    // Y gauge canvas
    const cy = this.root.querySelector<HTMLCanvasElement>("#gforce-y-gauge");
    if (cy) {
      cy.width = 30 * dpr;
      cy.height = 180 * dpr;
      cy.style.width = "30px";
      cy.style.height = "180px";
      const ctx2 = cy.getContext("2d")!;
      ctx2.scale(dpr, dpr);
      this.gYCanvas = cy;
      this.gYCtx = ctx2;
    }
    this.drawGForce();
    this.drawYGauge();
  }

  private drawGForce(): void {
    const ctx = this.gCtx;
    if (!ctx) return;
    const S = 180;
    const cx = S / 2;
    const cy = S / 2;
    const maxG = 2;
    const scale = (cx - 14) / maxG;

    ctx.clearRect(0, 0, S, S);

    // background circles
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let g = 0.5; g <= maxG; g += 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, g * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // cross-hair axes
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(cx, 6);
    ctx.lineTo(cx, S - 6);
    ctx.moveTo(6, cy);
    ctx.lineTo(S - 6, cy);
    ctx.stroke();

    // axis labels
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("X\u2192", S - 8, cy - 4);
    ctx.textAlign = "left";
    ctx.fillText("\u2191Z", cx + 3, 10);

    // ring labels
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.fillText("1G", cx + 1 * scale + 2, cy - 3);
    ctx.fillText("2G", cx + 2 * scale + 2, cy - 3);

    const { gx, gz } = this.gLatest;
    const dotX = cx + gx * scale;
    const dotY = cy - gz * scale;
    const clampX = Math.max(8, Math.min(S - 8, dotX));
    const clampY = Math.max(8, Math.min(S - 8, dotY));

    const mag = Math.sqrt(gx * gx + gz * gz);
    const hue = Math.max(0, 200 - mag * 100);
    const color = `hsl(${hue.toFixed(0)}, 100%, 55%)`;

    // line from center to dot
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(clampX, clampY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // dot
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(clampX, clampY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // G magnitude label near dot
    if (mag > 0.05) {
      const label = mag.toFixed(2) + "g";
      const offX = clampX > cx ? 8 : -8;
      const offY = clampY < cy ? -8 : 12;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = clampX >= cx ? "left" : "right";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(label, clampX + offX + 1, clampY + offY + 1);
      ctx.fillStyle = color;
      ctx.fillText(label, clampX + offX, clampY + offY);
    }
  }

  private drawYGauge(): void {
    const ctx = this.gYCtx;
    if (!ctx) return;
    const W = 30;
    const H = 180;
    const maxG = 2;
    const gy = this.gLatest.gy;
    const trackX = 11;
    const trackW = 8;
    const pxPerG = (H / 2 - 14) / maxG;
    const zeroY = H / 2;

    ctx.clearRect(0, 0, W, H);

    // track background
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(trackX, 10, trackW, H - 20, 4);
    ctx.fill();

    // fill bar from zero
    const barH = Math.min(Math.abs(gy), maxG) * pxPerG;
    const hue = Math.max(0, 200 - Math.abs(gy) * 100);
    const color = `hsl(${hue.toFixed(0)}, 100%, 55%)`;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (gy >= 0) {
      ctx.roundRect(trackX, zeroY - barH, trackW, barH, 3);
    } else {
      ctx.roundRect(trackX, zeroY, trackW, barH, 3);
    }
    ctx.fill();

    // tick marks and labels
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = "7px monospace";
    ctx.textAlign = "right";
    for (const g of [-2, -1, 0, 1, 2]) {
      const y = zeroY - g * pxPerG;
      const lbl = g > 0 ? "+" + g : String(g);
      ctx.fillText(lbl, trackX - 2, y + 3);
      ctx.beginPath();
      ctx.moveTo(trackX, y);
      ctx.lineTo(trackX + trackW, y);
      ctx.stroke();
    }

    // zero line stronger
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(trackX - 2, zeroY);
    ctx.lineTo(trackX + trackW + 2, zeroY);
    ctx.stroke();

    // Y axis label
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Y", 15, H - 2);

    // marker dot
    const markerY = Math.max(12, Math.min(H - 12, zeroY - gy * pxPerG));
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(trackX + trackW / 2, markerY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ── Drag support ───────────────────────────────────────────────────────── */

  private initDrag(): void {
    const card = this.root.querySelector<HTMLElement>("#card-gforce");
    if (!card) return;

    // restore saved position
    const saved = localStorage.getItem("gforcePos");
    if (saved) {
      try {
        const { x, y } = JSON.parse(saved);
        card.classList.add("card-floating");
        card.style.left = x + "px";
        card.style.top = y + "px";
      } catch {
        /* ignore */
      }
    }

    const titleBar = card.querySelector<HTMLElement>(".card-title")!;
    titleBar.classList.add("card-draggable");

    // double-click to toggle floating / grid mode
    titleBar.addEventListener("dblclick", () => {
      if (card.classList.contains("card-floating")) {
        card.classList.remove("card-floating");
        card.style.left = "";
        card.style.top = "";
        localStorage.removeItem("gforcePos");
      } else {
        const rect = card.getBoundingClientRect();
        card.classList.add("card-floating");
        card.style.left = rect.left + "px";
        card.style.top = rect.top + "px";
        localStorage.setItem(
          "gforcePos",
          JSON.stringify({ x: rect.left, y: rect.top }),
        );
      }
    });

    let dragging = false;
    let ox = 0,
      oy = 0;

    titleBar.addEventListener("mousedown", (e: MouseEvent) => {
      if (!card.classList.contains("card-floating")) {
        // first drag: pop out of grid flow
        const rect = card.getBoundingClientRect();
        card.classList.add("card-floating");
        card.style.left = rect.left + "px";
        card.style.top = rect.top + "px";
      }
      dragging = true;
      ox = e.clientX - card.offsetLeft;
      oy = e.clientY - card.offsetTop;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!dragging) return;
      card.style.left = e.clientX - ox + "px";
      card.style.top = e.clientY - oy + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      localStorage.setItem(
        "gforcePos",
        JSON.stringify({ x: card.offsetLeft, y: card.offsetTop }),
      );
    });
  }
}
