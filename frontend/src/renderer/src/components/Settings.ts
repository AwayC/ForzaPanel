import { TelemetryWS, DEFAULT_WS_URL } from "../services/websocket";

export class SettingsPanel {
  constructor(container: HTMLElement, ws: TelemetryWS) {
    const savedPort = localStorage.getItem("udpPort") ?? "5300";
    const savedWS = localStorage.getItem("wsURL") ?? DEFAULT_WS_URL;

    container.innerHTML = `
      <div class="settings-panel">
        <h2 class="settings-title">设置</h2>

        <div class="settings-section">
          <div class="settings-label">UDP 监听端口</div>
          <div class="settings-row">
            <input id="udp-port-input" class="settings-input" type="number"
              min="1024" max="65535" value="${savedPort}" />
            <button id="udp-apply-btn" class="settings-btn">应用</button>
          </div>
          <div class="settings-hint">修改后，Forza 游戏内的 UDP 输出端口也需同步修改为相同端口</div>
          <div id="udp-status" class="settings-status"></div>
        </div>

        <div class="settings-section">
          <div class="settings-label">WebSocket 地址</div>
          <div class="settings-row">
            <input id="ws-url-input" class="settings-input" type="text"
              value="${savedWS}" style="width:260px" />
            <button id="ws-apply-btn" class="settings-btn">重连</button>
          </div>
          <div class="settings-hint">默认 ws://localhost:8765/ws，本机运行无需修改</div>
        </div>

        <div class="settings-section">
          <div class="settings-label">Forza 遥测设置指引</div>
          <ol class="settings-guide">
            <li>进入 Forza Horizon 5 设置 → HUD 和游戏性 → 遥测</li>
            <li>将 "数据输出 IP" 设置为运行本程序的电脑 IP（同局域网时填对方 IP）</li>
            <li>将 "数据输出端口" 设置为上方配置的 UDP 端口（默认 5300）</li>
            <li>打开 "在比赛中启用数据输出"</li>
          </ol>
        </div>
      </div>`;

    const portInput =
      container.querySelector<HTMLInputElement>("#udp-port-input")!;
    const portBtn =
      container.querySelector<HTMLButtonElement>("#udp-apply-btn")!;
    const udpStatus = container.querySelector<HTMLElement>("#udp-status")!;
    const wsInput = container.querySelector<HTMLInputElement>("#ws-url-input")!;
    const wsBtn = container.querySelector<HTMLButtonElement>("#ws-apply-btn")!;

    // 收到后端配置确认时更新状态
    ws.onConfig((port) => {
      udpStatus.textContent = `✓ 后端已切换到端口 ${port}`;
      udpStatus.style.color = "var(--green)";
    });

    portBtn.addEventListener("click", () => {
      const port = parseInt(portInput.value, 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        udpStatus.textContent = "端口范围 1024-65535";
        udpStatus.style.color = "var(--red)";
        return;
      }
      localStorage.setItem("udpPort", String(port));
      ws.send({ type: "setUDPPort", udpPort: port });
      udpStatus.textContent = "命令已发送，等待确认...";
      udpStatus.style.color = "var(--muted)";
    });

    wsBtn.addEventListener("click", () => {
      const url = wsInput.value.trim();
      if (!url.startsWith("ws")) return;
      localStorage.setItem("wsURL", url);
      ws.setURL(url);
    });
  }
}
