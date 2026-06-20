// src/preload/index.ts
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 后续所有的流数据交互、文件选择IPC通道都将在此白名单中安全暴露
const api = {
  // 暂时留空，供后续任务逐步安全桥接
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}