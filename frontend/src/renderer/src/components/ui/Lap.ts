import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

function formatTime(sec: number): string {
  if (sec <= 0) return "--:--.---";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export class LapComponent extends BaseComponent {
  private elements: { [key: string]: HTMLElement } = {};

  constructor() {
    super("lap", "\u5708\u901f & \u4f4d\u7f6e");
    this.render();
  }

  render(): void {
    this.contentElement.innerHTML = `
      <div class="kv-grid">
        ${this.tplKV("LAP", "lap")}
        ${this.tplKV("POSITION", "pos")}
        ${this.tplKV("CURRENT", "current")}
        ${this.tplKV("LAST", "last")}
        ${this.tplKV("BEST", "best")}
        ${this.tplKV("DISTANCE", "dist")}
      </div>
    `;
    ["lap", "pos", "current", "last", "best", "dist"].forEach(id => {
      this.elements[id] = this.contentElement.querySelector(`.kv-val-${id}`)!;
    });
  }

  private tplKV(label: string, id: string): string {
    return `
      <div class="kv-row">
        <span class="kv-label">${label}</span>
        <span class="kv-val kv-val-${id}">0</span>
      </div>
    `;
  }

  update(d: TelemetryData): void {
    this.elements["lap"].textContent = d.LapNumber.toString();
    this.elements["pos"].textContent = d.RacePosition.toString();
    this.elements["current"].textContent = formatTime(d.CurrentLap);
    this.elements["last"].textContent = formatTime(d.LastLap);
    this.elements["best"].innerHTML = `<span style="color:var(--yellow)">${formatTime(d.BestLap)}</span>`;
    this.elements["dist"].textContent = `${(d.DistanceTraveled / 1000).toFixed(2)} km`;
  }
}
