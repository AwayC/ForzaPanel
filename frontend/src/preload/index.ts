import { contextBridge } from "electron";
import { electronApp } from "@electron-toolkit/utils";

contextBridge.exposeInMainWorld("electron", electronApp);
