import type { TelemetryData } from "../types/telemetry";

const CSV_HEADERS: (keyof TelemetryData)[] = [
  "TimestampMS",
  "Speed",
  "CurrentEngineRpm",
  "Gear",
  "Accel",
  "Brake",
  "Clutch",
  "Steer",
  "AccelerationX",
  "AccelerationY",
  "AccelerationZ",
  "Power",
  "Torque",
  "Boost",
  "Fuel",
  "TireTempFL",
  "TireTempFR",
  "TireTempRL",
  "TireTempRR",
  "TireSlipRatioFL",
  "TireSlipRatioFR",
  "TireSlipRatioRL",
  "TireSlipRatioRR",
  "TireWearFL",
  "TireWearFR",
  "TireWearRL",
  "TireWearRR",
  "NormalizedSuspensionTravelFL",
  "NormalizedSuspensionTravelFR",
  "NormalizedSuspensionTravelRL",
  "NormalizedSuspensionTravelRR",
  "PositionX",
  "PositionY",
  "PositionZ",
  "CurrentLap",
  "LastLap",
  "BestLap",
  "LapNumber",
  "RacePosition",
  "Yaw",
  "Pitch",
  "Roll",
];

export class ExportPanel {
  private buffer: TelemetryData[] = [];
  private recording = false;
  private maxRecords = 36000; // ~60 分钟 @ 10fps

  private statusEl!: HTMLElement;
  private countEl!: HTMLElement;

  constructor(container: HTMLElement, _ws: unknown) {
    container.innerHTML = `
      <div class="export-panel">
        <h2 class="settings-title">数据录制 & 导出</h2>

        <div class="settings-section">
          <div class="export-controls">
            <button id="rec-btn" class="settings-btn btn-red">● 开始录制</button>
            <button id="export-btn" class="settings-btn" disabled>⬇ 导出 CSV</button>
            <button id="clear-btn" class="settings-btn btn-muted">清空</button>
          </div>
          <div class="export-info">
            <span id="rec-status" class="settings-status">未录制</span>
            &nbsp;|&nbsp;
            已录制 <span id="rec-count">0</span> 帧
            （约 <span id="rec-time">0</span> 秒）
          </div>
          <div class="settings-hint">
            录制时会缓存到内存，最多 ${this.maxRecords.toLocaleString()} 帧。<br/>
            导出为 CSV，可用 Excel 或 Python/pandas 分析。
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-label">CSV 字段预览</div>
          <div class="csv-preview">${CSV_HEADERS.join(", ")}</div>
        </div>
      </div>`;

    this.statusEl = container.querySelector("#rec-status")!;
    this.countEl = container.querySelector("#rec-count")!;
    const timeEl = container.querySelector<HTMLElement>("#rec-time")!;

    const recBtn = container.querySelector<HTMLButtonElement>("#rec-btn")!;
    const exportBtn =
      container.querySelector<HTMLButtonElement>("#export-btn")!;
    const clearBtn = container.querySelector<HTMLButtonElement>("#clear-btn")!;

    recBtn.addEventListener("click", () => {
      this.recording = !this.recording;
      if (this.recording) {
        recBtn.textContent = "■ 停止录制";
        recBtn.classList.remove("btn-red");
        recBtn.classList.add("btn-green");
        this.statusEl.textContent = "录制中...";
        this.statusEl.style.color = "var(--red)";
      } else {
        recBtn.textContent = "● 开始录制";
        recBtn.classList.add("btn-red");
        recBtn.classList.remove("btn-green");
        this.statusEl.textContent = "已停止";
        this.statusEl.style.color = "var(--muted)";
        exportBtn.disabled = this.buffer.length === 0;
      }
    });

    exportBtn.addEventListener("click", () => this.exportCSV());
    clearBtn.addEventListener("click", () => {
      this.buffer = [];
      this.countEl.textContent = "0";
      timeEl.textContent = "0";
      exportBtn.disabled = true;
    });

    // 每秒更新计数
    setInterval(() => {
      if (this.recording) {
        this.countEl.textContent = String(this.buffer.length);
        timeEl.textContent = (this.buffer.length / 10).toFixed(0);
        exportBtn.disabled = false;
      }
    }, 1000);
  }

  record(data: TelemetryData): void {
    if (!this.recording) return;
    if (this.buffer.length >= this.maxRecords) return;
    this.buffer.push({ ...data });
  }

  private exportCSV(): void {
    if (this.buffer.length === 0) return;

    const rows = [CSV_HEADERS.join(",")];
    for (const d of this.buffer) {
      rows.push(
        CSV_HEADERS.map((k) => {
          const v = d[k];
          return typeof v === "number" ? v.toFixed(6) : String(v ?? "");
        }).join(","),
      );
    }

    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `forza_telemetry_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
