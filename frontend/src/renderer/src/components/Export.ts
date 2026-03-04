import type { TelemetryData } from "../types/telemetry";

const CSV_HEADERS: (keyof TelemetryData)[] = [
  "IsRaceOn", "TimestampMS", "Speed", "CurrentEngineRpm", "Gear", "Accel", "Brake", "Clutch", "Steer",
  "AccelerationX", "AccelerationY", "AccelerationZ", "Power", "Torque", "Boost", "Fuel",
  "TireTempFL", "TireTempFR", "TireTempRL", "TireTempRR", "TireSlipRatioFL", "TireSlipRatioFR",
  "TireSlipRatioRL", "TireSlipRatioRR", "TireWearFL", "TireWearFR", "TireWearRL", "TireWearRR",
  "NormalizedSuspensionTravelFL", "NormalizedSuspensionTravelFR", "NormalizedSuspensionTravelRL",
  "NormalizedSuspensionTravelRR", "PositionX", "PositionY", "PositionZ", "CurrentLap",
  "LastLap", "BestLap", "LapNumber", "RacePosition", "Yaw", "Pitch", "Roll",
  "NormalizedDrivingLine", "NormalizedAIBrakeDifference"
];

export class ExportPanel {
  private buffer: TelemetryData[] = [];
  private recording = false;
  private maxRecords = 36000; 

  private statusEl!: HTMLElement;
  private countEl!: HTMLElement;
  private onDataCallback?: (data: TelemetryData) => void;

  constructor(container: HTMLElement, onData?: (data: TelemetryData) => void) {
    this.onDataCallback = onData;
    container.innerHTML = `
      <div class="export-panel">
        <h2 class="settings-title">\u6570\u636e\u5f55\u5236 & \u5bfc\u51fa</h2>

        <div class="settings-section">
          <div class="export-controls">
            <button id="rec-btn" class="settings-btn btn-red">\u25cf \u5f00\u59cb\u5f55\u5236</button>
            <button id="export-btn" class="settings-btn" disabled>\u2b07 \u5bfc\u51fa CSV</button>
            <button id="clear-btn" class="settings-btn btn-muted">\u6e05\u7a7a</button>
          </div>
          <div class="export-info">
            <span id="rec-status" class="settings-status">\u672a\u5f55\u5236</span>
            &nbsp;|&nbsp;
            \u5df2\u5f55\u5236 <span id="rec-count">0</span> \u5e27
          </div>
        </div>

        <h2 class="settings-title">\u56de\u653e\u6a21\u5f0f</h2>
        <div class="settings-section">
          <div class="export-controls">
            <input type="file" id="replay-file" accept=".csv" style="display:none">
            <button id="load-btn" class="settings-btn">\ud83d\udcc1 \u52a0\u8f7d CSV</button>
            <button id="play-btn" class="settings-btn" disabled>\u25b6 \u5f00\u59cb\u56de\u653e</button>
          </div>
          <p class="settings-hint">\u52a0\u8f7d\u4e4b\u524d\u5bfc\u51fa\u7684 CSV \u6587\u4ef6\u8fdb\u884c\u6570\u636e\u56de\u653e</p>
        </div>
      </div>`;

    this.statusEl = container.querySelector("#rec-status")!;
    this.countEl = container.querySelector("#rec-count")!;
    const recBtn = container.querySelector<HTMLButtonElement>("#rec-btn")!;
    const exportBtn = container.querySelector<HTMLButtonElement>("#export-btn")!;
    const clearBtn = container.querySelector<HTMLButtonElement>("#clear-btn")!;
    const loadBtn = container.querySelector<HTMLButtonElement>("#load-btn")!;
    const playBtn = container.querySelector<HTMLButtonElement>("#play-btn")!;
    const fileInput = container.querySelector<HTMLInputElement>("#replay-file")!;

    recBtn.addEventListener("click", () => {
      this.recording = !this.recording;
      if (this.recording) {
        recBtn.textContent = "\u25a0 \u505c\u6b62\u5f55\u5236"; // ■ 停止录制
        recBtn.classList.add("btn-green");
        this.statusEl.textContent = "\u7b49\u5f85\u6bd4\u8d5b\u5f00\u59cb..."; // 等待比赛开始...
        document.body.classList.add("record-mode");
      } else {
        recBtn.textContent = "\u25cf \u5f00\u59cb\u5f55\u5236"; // ● 开始录制
        recBtn.classList.remove("btn-green");
        this.statusEl.textContent = "\u5df2\u505c\u6b62"; // 已停止
        document.body.classList.remove("record-mode");
        exportBtn.disabled = this.buffer.length === 0;
      }
    });

    exportBtn.addEventListener("click", () => this.exportCSV());
    clearBtn.addEventListener("click", () => {
      this.buffer = [];
      this.countEl.textContent = "0";
      exportBtn.disabled = true;
    });

    loadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => this.handleFile(e, playBtn));
    playBtn.addEventListener("click", () => this.startReplay(playBtn));

    setInterval(() => {
      if (this.recording) {
        this.countEl.textContent = String(this.buffer.length);
      }
    }, 1000);
  }

  private replayBuffer: TelemetryData[] = [];
  private replaying = false;

  private handleFile(e: Event, playBtn: HTMLButtonElement) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split("\n");
      const headers = lines[0].split(",");
      const data: TelemetryData[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const vals = lines[i].split(",");
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = parseFloat(vals[idx]);
        });
        
        // Backwards compatibility for older CSVs that didn't export these fields
        if (obj.IsRaceOn === undefined || isNaN(obj.IsRaceOn)) obj.IsRaceOn = 1;
        if (obj.NormalizedDrivingLine === undefined || isNaN(obj.NormalizedDrivingLine)) obj.NormalizedDrivingLine = 0;
        if (obj.NormalizedAIBrakeDifference === undefined || isNaN(obj.NormalizedAIBrakeDifference)) obj.NormalizedAIBrakeDifference = 0;
        
        data.push(obj as TelemetryData);
      }
      this.replayBuffer = data;
      playBtn.disabled = data.length === 0;
      alert(`\u5df2\u52a0\u8f7d ${data.length} \u6761\u6570\u636e`);
    };
    reader.readAsText(file);
  }

  private startReplay(playBtn: HTMLButtonElement) {
    if (this.replaying) {
      this.replaying = false;
      playBtn.textContent = "\u25b6 \u5f00\u59cb\u56de\u653e"; // ▶ 开始回放
      document.body.classList.remove("replay-mode");
      return;
    }

    if (this.replayBuffer.length === 0) return;

    this.replaying = true;
    playBtn.textContent = "\u25a0 \u505c\u6b62\u56de\u653e"; // ■ 停止回放
    document.body.classList.add("replay-mode");
    
    // Notify other components to clear old lines
    window.dispatchEvent(new Event("replay:start"));

    let idx = 0;
    let startRealTime = performance.now();
    let startGameTime = this.replayBuffer[0].TimestampMS;

    const tick = () => {
      if (!this.replaying) return;

      if (idx >= this.replayBuffer.length) {
        this.replaying = false;
        playBtn.textContent = "\u25b6 \u5f00\u59cb\u56de\u653e"; // ▶ 开始回放
        document.body.classList.remove("replay-mode");
        return;
      }

      const now = performance.now();
      const elapsedReal = now - startRealTime;
      
      // Process all frames that are due
      while (idx < this.replayBuffer.length) {
        const data = this.replayBuffer[idx];
        const elapsedGame = data.TimestampMS - startGameTime;
        
        // Handle potential timestamp wraparound or reset in the recording
        if (elapsedGame < 0) {
          startGameTime = data.TimestampMS;
          startRealTime = performance.now();
        } else if (elapsedGame <= elapsedReal) {
          if (this.onDataCallback) {
            this.onDataCallback(data);
          }
          idx++;
        } else {
          // Not time for this frame yet
          break; 
        }
      }

      if (this.replaying) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  record(data: TelemetryData): void {
    if (!this.recording) return;
    
    // Check if we are actively racing
    if (data.IsRaceOn !== 1) {
      this.statusEl.textContent = "\u6682\u505c/\u83dc\u5355\u4e2d (\u7b49\u5f85\u6570\u636e...)"; // 暂停/菜单中 (等待数据...)
      return; 
    }
    
    this.statusEl.textContent = "\u5f55\u5236\u4e2d..."; // 录制中...
    if (this.buffer.length >= this.maxRecords) return;
    this.buffer.push({ ...data });
  }

  private exportCSV(): void {
    const rows = [CSV_HEADERS.join(",")];
    for (const d of this.buffer) {
      rows.push(CSV_HEADERS.map((k) => (d[k] as number).toFixed(6)).join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forza_telemetry_${new Date().getTime()}.csv`;
    a.click();
  }
}
