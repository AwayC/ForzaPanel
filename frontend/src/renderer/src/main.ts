import { telemetryWS } from "./services/websocket";
import { Dashboard } from "./components/Dashboard";
import { Charts } from "./components/Charts";
import { RouteMap } from "./components/RouteMap";
import { ExportPanel } from "./components/Export";
import { SettingsPanel } from "./components/Settings";
import "./styles/app.css";

// ── 初始化各模块 ───────────────────────────────────────────────────────────────────
const dashboard = new Dashboard(document.getElementById("app")!);
const charts = new Charts(document.getElementById("charts")!);
const routeMap = new RouteMap(document.getElementById("route-map")!);
const exportPanel = new ExportPanel(
  document.getElementById("export-panel")!,
  telemetryWS,
);
new SettingsPanel(document.getElementById("settings-panel")!, telemetryWS);

// ── Tab 切换 ───────────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    document
      .getElementById(`tab-${btn.dataset.tab}`)
      ?.classList.remove("hidden");
    if (btn.dataset.tab === "route") routeMap.onVisible();
  });
});

// ── 数据管线 ───────────────────────────────────────────────────────────────────
telemetryWS.onData((data) => {
  dashboard.update(data);
  charts.push(data);
  routeMap.push(data);
  exportPanel.record(data);
});

// ── 连接状态 ───────────────────────────────────────────────────────────────────
const statusEl = document.getElementById("status")!;
const udpStatusEl = document.getElementById("udp-status")!;
const udpToggleBtn = document.getElementById(
  "udp-toggle-btn",
)! as HTMLButtonElement;
let udpListening = false;

document.addEventListener("ws:status", (e) => {
  const s = (e as CustomEvent<string>).detail;
  statusEl.textContent = s === "connected" ? "● 已连接" : "○ 等待连接...";
  statusEl.className = s === "connected" ? "status-on" : "status-off";
  udpToggleBtn.disabled = s !== "connected";
});

document.addEventListener("ws:udpStatus", (e: Event) => {
  const { listening, port } = (
    e as CustomEvent<{ listening: boolean; port: number }>
  ).detail;
  udpListening = listening;
  if (listening) {
    udpStatusEl.textContent = `◉ UDP :${port}`;
    udpStatusEl.className = "status-on udp-status";
    udpToggleBtn.textContent = "■ 停止监听";
    udpToggleBtn.classList.add("udp-ctrl-stop");
    udpToggleBtn.classList.remove("udp-ctrl-start");
  } else {
    udpStatusEl.textContent = "◌ UDP 已停止";
    udpStatusEl.className = "status-off udp-status";
    udpToggleBtn.textContent = "▶ 开始监听";
    udpToggleBtn.classList.add("udp-ctrl-start");
    udpToggleBtn.classList.remove("udp-ctrl-stop");
  }
});

udpToggleBtn.addEventListener("click", () => {
  if (udpListening) {
    telemetryWS.send({ type: "stopUDP" });
  } else {
    const port = parseInt(localStorage.getItem("udpPort") ?? "5300", 10);
    telemetryWS.send({ type: "startUDP", udpPort: port });
  }
});
