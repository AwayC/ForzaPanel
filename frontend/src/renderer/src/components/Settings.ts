import type { TelemetryWS } from "../services/websocket";

export class SettingsPanel {
  private root: HTMLElement;
  private ws: TelemetryWS;

  constructor(container: HTMLElement, ws: TelemetryWS) {
    this.root = container;
    this.ws = ws;
    this.render();
  }

  private render(): void {
    const savedIP = localStorage.getItem("udpIP") ?? "127.0.0.1";
    const savedPort = localStorage.getItem("udpPort") ?? "5300";
    const savedMode = localStorage.getItem("appMode") ?? "casual";

    this.root.innerHTML = `
      <div class="settings-panel">
        <div class="settings-section">
          <div class="settings-label">UDP \u914d\u7f6e</div>
          <div class="settings-row">
            <input type="text" id="udp-ip" class="settings-input" placeholder="IP" value="${savedIP}">
            <input type="number" id="udp-port" class="settings-input" placeholder="\u7aef\u53e3" value="${savedPort}">
            <button id="save-udp" class="btn">\u4fdd\u5b58\u5e76\u5e94\u7528</button>
          </div>
          <p class="settings-hint">Forza \u53d1\u9001\u6570\u636e\u7684\u76ee\u6807 IP \u548c\u7aef\u53e3</p>
        </div>

        <div class="settings-section">
          <div class="settings-label">\u6a21\u5f0f\u9009\u62e9</div>
          <div class="settings-row">
            <select id="app-mode" class="settings-input" style="width: 150px">
              <option value="casual" ${savedMode === "casual" ? "selected" : ""}>\u4f11\u95f2\u6a21\u5f0f</option>
              <option value="race" ${savedMode === "race" ? "selected" : ""}>\u6bd4\u8d5b\u6a21\u5f0f</option>
            </select>
          </div>
          <p class="settings-hint">\u6bd4\u8d5b\u6a21\u5f0f\u4e0b\uff0c\u5f53\u8f6e\u80ce\u5931\u63a7\u6216\u8f6c\u5411\u4e0d\u8db3\u65f6\u4f1a\u6709\u8b66\u544a\u63d0\u793a</p>
        </div>
      </div>
    `;

    this.root.querySelector("#save-udp")!.addEventListener("click", () => {
      const ip = (this.root.querySelector("#udp-ip") as HTMLInputElement).value;
      const port = parseInt((this.root.querySelector("#udp-port") as HTMLInputElement).value);
      localStorage.setItem("udpIP", ip);
      localStorage.setItem("udpPort", port.toString());
      this.ws.send({ type: "setUDPConfig", udpIP: ip, udpPort: port });
    });

    this.root.querySelector("#app-mode")!.addEventListener("change", (e) => {
      const mode = (e.target as HTMLSelectElement).value;
      localStorage.setItem("appMode", mode);
      // Dispatch event to update dashboard mode
      window.dispatchEvent(new CustomEvent("app:modeChange", { detail: mode }));
    });
  }
}
