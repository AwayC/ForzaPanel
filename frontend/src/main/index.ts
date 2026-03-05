import { app, BrowserWindow, shell } from "electron";
import { join, dirname } from "path";
import { is } from "@electron-toolkit/utils";
import { spawn, spawnSync, ChildProcess, exec } from "child_process";
import fs from "fs";

// 解决 GPU 磁盘缓存权限错误 (0x5 Access Denied)
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

let backendProcess: ChildProcess | null = null;

function startBackend() {
  const isDev = !!(is.dev && process.env["ELECTRON_RENDERER_URL"]);
  let backendPath = "";
  let args: string[] = [];
  let cwdPath = "";

  const runBackend = () => {
    let rootPath = isDev ? app.getAppPath() : process.resourcesPath;

    // 向上查找直到找到 backend 目录
    if (isDev) {
      while (rootPath.length > 3 && !fs.existsSync(join(rootPath, "backend"))) {
        rootPath = dirname(rootPath);
      }
    }

    console.log("[Electron] Detected RootPath:", rootPath);

    if (isDev) {
      backendPath = "go";
      const mainGoPath = join(rootPath, "backend/src/server/main.go");
      args = ["run", mainGoPath];
      cwdPath = join(rootPath, "backend");
      console.log(`[Electron] Dev Mode: Executing -> go ${args.join(" ")}`);
    } else {
      backendPath = join(rootPath, "server.exe");
      cwdPath = rootPath;
      console.log(`[Electron] Prod Mode: Executing -> ${backendPath}`);
    }

    try {
      backendProcess = spawn(backendPath, args, {
        cwd: cwdPath,
        stdio: "pipe", // 关键修改：允许我们在终端看到 Go 的输出
        shell: isDev ? true : false, // Dev 模式必须开启 shell 才能找到 go 命令
        env: process.env,
        windowsHide: true,
      });

      // 监听 Go 后端的正常输出
      backendProcess.stdout?.on("data", (data) => {
        console.log(`[Go Output] ${data.toString().trim()}`);
      });

      // 监听 Go 后端的错误输出
      backendProcess.stderr?.on("data", (data) => {
        console.error(`[Go Error] ${data.toString().trim()}`);
      });

      backendProcess.on("error", (err: any) => {
        console.error("[Backend Process Error]:", err.message);
      });

      backendProcess.on("close", (code) => {
        console.log(`[Backend Process] Exited with code ${code}`);
      });
    } catch (e) {
      console.error("[Backend] Catch Error:", e);
    }
  };

  // 启动前先尝试清理可能残留的生产环境 server.exe
  if (process.platform === "win32") {
    exec("taskkill /f /im server.exe /t", () => {
      // 无论 taskkill 是否报错（找不到进程也会报错），都继续执行启动逻辑
      runBackend();
    });
  } else {
    runBackend();
  }
}
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true, // 🚨 关键修改 1：直接设为 true，双击图标瞬间弹出黑框！
    title: "ForzaPanel",
    backgroundColor: "#0f0f0f", // 有了这个深色背景，瞬间弹出也不会刺眼
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  // 🚨 关键修改 2：彻底删掉 ready-to-show 监听，不要等它“准备好”再显示

  // 外部链接在浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  // 1. 第一时间召唤界面，不浪费一毫秒
  createWindow();

  // 2. 🚨 关键修改 3：区分开发和生产环境的后端启动策略
  const isDev = !!(is.dev && process.env["ELECTRON_RENDERER_URL"]);
  if (isDev) {
    // 开发环境下（npm run dev），为了防止和旧进程冲突，稍微等 0.5 秒
    setTimeout(() => {
      startBackend();
    }, 500);
  } else {
    // 生产环境下（打包后的 exe），直接火力全开，光速拉起 Go 引擎
    startBackend();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 退出前杀掉后端进程树
app.on("before-quit", () => {
  if (backendProcess) {
    if (process.platform === "win32") {
      // /t 参数会把 go run 衍生的子进程（实际的服务器）一起杀掉
      spawnSync(
        "taskkill",
        ["/pid", backendProcess.pid?.toString() || "", "/f", "/t"],
        { windowsHide: true },
      );
    } else {
      backendProcess.kill();
    }
  }
});
