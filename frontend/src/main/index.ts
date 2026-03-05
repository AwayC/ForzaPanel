import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { spawn, spawnSync, ChildProcess } from "child_process";
import path from "path";

// 解决 GPU 磁盘缓存权限错误 (0x5 Access Denied)
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

let backendProcess: ChildProcess | null = null;

function startBackend() {
  const isDev = !!(is.dev && process.env["ELECTRON_RENDERER_URL"]);
  let backendPath = "";
  let args: string[] = [];

  const runBackend = () => {
    // electron-vite 开发环境下 app.getAppPath() 通常在 frontend 目录或其子目录
    // 我们需要找到包含 backend 文件夹的根目录 (Forza)
    let rootPath = isDev ? app.getAppPath() : process.resourcesPath;
    
    // 向上查找直到找到 backend 目录或到达顶层
    if (isDev) {
      while (rootPath.length > 3 && !require("fs").existsSync(path.join(rootPath, "backend"))) {
        rootPath = path.dirname(rootPath);
      }
    }

    console.log("[Backend] Detected RootPath:", rootPath);

    if (isDev) {
      backendPath = "go";
      const mainGoPath = path.join(rootPath, "backend/src/server/main.go");
      args = ["run", mainGoPath];
      console.log("[Backend] MainGoPath:", mainGoPath);
    } else {
      backendPath = path.join(rootPath, "server.exe");
    }

    backendProcess = spawn(backendPath, args, {
      cwd: isDev ? path.join(rootPath, "backend") : rootPath,
      stdio: isDev ? "inherit" : "ignore",
      shell: false, // 禁用 shell 以避免 cmd.exe ENOENT 错误
      env: process.env, // 确保继承环境变量 (包括 PATH)
      windowsHide: true,
    });

    backendProcess.on("error", (err: any) => {
      console.error("[Backend] Failed to start:", err.message);
      if (err.code === "ENOENT") {
        console.error("[Backend] 'go' command not found in PATH. Please ensure Go is installed.");
      }
    });
  };

  // 异步清理进程，确保不论清理是否成功都会尝试启动后端
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/f", "/im", "server.exe", "/t"], { windowsHide: true });
    killer.on("close", () => {
      if (isDev) {
        const devKiller = spawn("taskkill", ["/f", "/im", "main.exe", "/t"], { windowsHide: true });
        devKiller.on("close", runBackend);
      } else {
        runBackend();
      }
    });
    // 如果没有进程可杀，taskkill 可能会报错，我们需要捕获
    killer.on("error", () => runBackend());
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
    show: false, // 先隐藏，等加载或 ready-to-show 再显示
    title: "ForzaPanel",
    backgroundColor: "#0f0f0f",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => {
    win.show();
  });

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
  // 1. 先启动窗口，让用户立刻看到界面
  createWindow();
  
  // 2. 稍微延迟启动后端，避免抢占主线程初始化资源
  setTimeout(() => {
    startBackend();
  }, 500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 退出前杀掉后端进程
app.on("before-quit", () => {
  if (backendProcess) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", backendProcess.pid?.toString() || "", "/f", "/t"], { windowsHide: true });
    } else {
      backendProcess.kill();
    }
  }
});
