# Forza Telemetry Dashboard

基于 Go 和 Electron 的 Forza 系列游戏（Forza Horizon 4/5, Forza Motorsport 7/8）UDP 遥测数据监听器与实时数据看板。

该项目能够实时获取并在精美的仪表盘上展示你在 Forza 中的驾驶数据，提供性能分析、2D/3D 路线追踪以及数据导出与回放功能。

## ✨ 核心特性

- **🚀 高性能后端**：采用 Go 语言编写的 UDP 监听服务器，极低延迟解析并分发数以百计的游戏遥测字段。
- **📊 现代化实时看板**：基于 Electron + TypeScript 构建，包含：
  - **核心仪表**：时速、转速 (RPM)、档位、踏板力度指示（油门/刹车/离合）。
  - **车辆动态**：水平/垂直 G 力动态坐标图、轮胎状态（四轮温度、滑移率模拟条）。
  - **实时图表**：可自选或整合显示的折线图，直观记录速度、转速、G力及踏板状态的历史趋势。
- **🗺️ 2D / 3D 路线地图**：
  - 支持高达 50 万个坐标点的高效追踪与渲染。
  - **2D 俯视** & **3D 空间网格**视图。
  - 根据车速或驾驶赛线偏离度（蓝 -> 红）进行路线智能着色。
- **💽 数据录制与 1:1 回放**：
  - 智能过滤暂停数据，将比赛中的遥测数据精准导出为 `.csv` 文件。
  - 支持载入历史数据进行 100% 真实时间戳速率的回放分析，并带有醒目的全局回放提示。
- **⚙️ 个性化设置**：自定义 UDP 监听端口，提供休闲与比赛两种预警模式。

## 🛠️ 技术栈

- **后端**: Go (Goroutines, UDP Socket, WebSocket)
- **前端**: Electron, Vite, TypeScript, HTML5 Canvas API, 原生 CSS
- **构建工具**: npm / vite

## 🚀 快速开始

### 1. 配置游戏 (Forza Horizon / Motorsport)
在游戏中进入 **设置 (Settings)** -> **HUD 和游戏体验 (HUD and Gameplay)**：
- 开启 **数据输出 (Data Out)**
- 设置 **数据输出 IP (Data Out IP Address)** 为你运行此程序的电脑 IP（如果在本机运行，填 `127.0.0.1`）
- 设置 **数据输出端口 (Data Out IP Port)**（默认 `5300`，可在程序设置中修改）

### 2. 运行项目

确保你已安装了 [Node.js](https://nodejs.org/) 和 [Go 环境](https://golang.org/)。

**启动后端服务 (Go)**:
```bash
cd backend
go run src/server/main.go
```

**启动前端界面 (Electron)**:
```bash
cd frontend
npm install
npm run dev
```
*(提示: 项目根目录下也提供了一个 `start.ps1` 脚本用于快速启动)*

## 📦 打包与构建

如果你想将前端构建为可执行的独立应用程序：
```bash
cd frontend
npm run build
npm run package # 或执行 npm run make 根据 electron-builder 的配置
```

## 🎮 使用指南

1. **连接与监听**：启动前后端后，在主界面的“状态栏”点击“▶ 开始监听”。确保游戏正在运行且处于比赛/驾驶状态。
2. **面板交互**：
   - 仪表盘卡片支持拖拽调整布局（自动吸附）。
   - 图表页面可勾选你关心的字段，开启“整合显示”可将多条数据重叠对比。
   - 路线图支持鼠标滚轮缩放，左键（3D）或右键（2D）拖拽平移旋转视角。
3. **数据回放**：在设置页面点击“开始录制”，跑完一圈后“导出 CSV”。之后加载该 CSV 即可重温你的高光表现。

## 📄 数据结构参考

项目完美适配 Sled 和 Dash 格式的 UDP 数据包。详细的数据结构体定义请参考 `backend/src/internal/forza_data/structs.go`。
