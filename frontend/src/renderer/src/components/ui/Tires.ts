import type { TelemetryData } from "../../types/telemetry";
import { BaseComponent } from "./BaseComponent";

export class TiresComponent extends BaseComponent {
  private tires: { [key: string]: { bar: HTMLElement; val: HTMLElement; temp: HTMLElement } } = {};

  constructor() {
    super("tires", "\u8f6e\u80ce");
    this.render();
  }

  render(): void {
    this.contentElement.innerHTML = `
      <div class="tires-grid">
        ${this.tplTire("FL")}
        ${this.tplTire("FR")}
        ${this.tplTire("RL")}
        ${this.tplTire("RR")}
      </div>
    `;
    ["FL", "FR", "RL", "RR"].forEach((id) => {
      this.tires[id] = {
        bar: this.contentElement.querySelector(`.tire-bar-fill-${id}`)!,
        val: this.contentElement.querySelector(`.tire-val-${id}`)!,
        temp: this.contentElement.querySelector(`.tire-temp-${id}`)!,
      };
    });
  }

  private tplTire(id: string): string {
    return `
      <div class="tire-unit tire-unit-${id}">
        <div class="tire-label">${id}</div>
        <div class="tire-bar-track">
          <div class="tire-bar-fill tire-bar-fill-${id}"></div>
        </div>
        <div class="tire-info">
          <div class="tire-val tire-val-${id}">0.00</div>
          <div class="tire-temp tire-temp-${id}">0\u00b0C</div>
        </div>
      </div>
    `;
  }

  update(d: TelemetryData): void {
    const updateTire = (id: string, slip: number, temp: number) => {
      const clamped = Math.min(Math.abs(slip), 1);
      const hPct = clamped * 100;
      const bar = this.tires[id].bar;
      bar.style.height = `${hPct}%`;
      
      // 0→blue(200), 0.5→yellow(60), 1→red(0)
      const hue = (1 - clamped) * 200;
      bar.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
      if (Math.abs(slip) > 1) bar.style.backgroundColor = "var(--red)";

      this.tires[id].val.textContent = Math.abs(slip).toFixed(2);
      this.tires[id].temp.textContent = `${Math.round(temp)}\u00b0C`;
    };

    updateTire("FL", d.TireSlipRatioFL, d.TireTempFL);
    updateTire("FR", d.TireSlipRatioFR, d.TireTempFR);
    updateTire("RL", d.TireSlipRatioRL, d.TireTempRL);
    updateTire("RR", d.TireSlipRatioRR, d.TireTempRR);
  }
}
