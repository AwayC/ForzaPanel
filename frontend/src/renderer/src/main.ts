import { telemetryWS } from "./services/websocket";
import { Dashboard } from "./components/Dashboard";
import { Charts } from "./components/Charts";
import { ExportPanel } from "./components/Export";
import { SettingsPanel } from "./components/Settings";
import "./styles/app.css";

// ── 初始化各模块 ───────────────────────────────────────────────────────────────
const dashboard = new Dashboard(document.getElementById("app")!);
const charts = new Charts(document.getElementById("charts")!);
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
  });
});

// ── 数据管线 ───────────────────────────────────────────────────────────────────
telemetryWS.onData((data) => {
  dashboard.update(data);
  charts.push(data);
  exportPanel.record(data);
});

// ── 连接状态 ───────────────────────────────────────────────────────────────────
const statusEl = document.getElementById("status")!;
document.addEventListener("ws:status", (e) => {
  const s = (e as CustomEvent<string>).detail;
  statusEl.textContent = s === "connected" ? "● 已连接" : "○ 等待连接...";
  statusEl.className = s === "connected" ? "status-on" : "status-off";
});
