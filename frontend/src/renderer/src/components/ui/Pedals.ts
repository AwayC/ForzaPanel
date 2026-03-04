import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class PedalsComponent extends BaseComponent {
  private bars: { [key: string]: { fill: HTMLElement; val: HTMLElement } } = {};

  constructor() {
    super("pedals", "\u8e0f\u677f");
    this.render();
  }

  render(): void {
    this.contentElement.innerHTML = `
      <div class="pedals-container">
        ${this.tplBar("ACCEL", "accel", "var(--green)")}
        ${this.tplBar("BRAKE", "brake", "var(--red)")}
        ${this.tplBar("CLUTCH", "clutch", "var(--yellow)")}
      </div>
    `;
    ["accel", "brake", "clutch"].forEach((id) => {
      this.bars[id] = {
        fill: this.contentElement.querySelector(`.bar-fill-${id}`)!,
        val: this.contentElement.querySelector(`.bar-val-${id}`)!,
      };
    });
  }

  private tplBar(label: string, id: string, color: string): string {
    return `
      <div class="pedal-row">
        <div class="pedal-label">${label}</div>
        <div class="pedal-bar-track">
          <div class="pedal-bar-fill bar-fill-${id}" style="background-color: ${color}"></div>
        </div>
        <div class="pedal-val bar-val-${id}">0%</div>
      </div>
    `;
  }

  update(d: TelemetryData): void {
    const updateBar = (id: string, val: number) => {
      const pct = (val / 255) * 100;
      this.bars[id].fill.style.width = `${pct}%`;
      this.bars[id].val.textContent = `${Math.round(pct)}%`;
    };
    updateBar("accel", d.Accel);
    updateBar("brake", d.Brake);
    updateBar("clutch", d.Clutch);
  }
}
