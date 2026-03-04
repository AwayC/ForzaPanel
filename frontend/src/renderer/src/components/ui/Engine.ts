import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class EngineComponent extends BaseComponent {
  private elements: { [key: string]: HTMLElement } = {};

  constructor() {
    super("engine", "\u53d1\u52a8\u673a");
    this.render();
  }

  render(): void {
    this.contentElement.innerHTML = `
      <div class="kv-grid">
        ${this.tplKV("POWER", "power")}
        ${this.tplKV("TORQUE", "torque")}
        ${this.tplKV("BOOST", "boost")}
        ${this.tplKV("FUEL", "fuel")}
      </div>
    `;
    ["power", "torque", "boost", "fuel"].forEach(id => {
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
    this.elements["power"].innerHTML = `${(d.Power / 1000).toFixed(1)} <span class="kv-unit">kW</span>`;
    this.elements["torque"].innerHTML = `${d.Torque.toFixed(1)} <span class="kv-unit">N\u00b7m</span>`;
    this.elements["boost"].innerHTML = `${d.Boost.toFixed(2)} <span class="kv-unit">psi</span>`;
    this.elements["fuel"].innerHTML = `${(d.Fuel * 100).toFixed(1)} <span class="kv-unit">%</span>`;
  }
}
