// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

const ipcChannels = {
  selectAudioFiles: 'dialog:select-audio-files',
  selectImportFolder: 'dialog:select-import-folder',
  selectOutputDirectory: 'dialog:select-output-directory'
} as const

// 后续所有的流数据交互、文件选择 IPC 通道都必须在此白名单中逐项暴露。
const api = {
  selectAudioFiles: (): Promise<string[]> => ipcRenderer.invoke(ipcChannels.selectAudioFiles),
  selectImportFolder: (): Promise<string[]> => ipcRenderer.invoke(ipcChannels.selectImportFolder),
  selectOutputDirectory: (): Promise<string | null> => ipcRenderer.invoke(ipcChannels.selectOutputDirectory)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
}
