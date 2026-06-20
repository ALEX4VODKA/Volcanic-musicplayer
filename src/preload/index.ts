// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

const ipcChannels = {
  selectAudioFiles: 'dialog:select-audio-files',
  selectImportFolder: 'dialog:select-import-folder',
  importDroppedFiles: 'file:import-dropped-files',
  selectOutputDirectory: 'dialog:select-output-directory',
  startConversion: 'conversion:start',
  conversionUpdate: 'conversion:update',
  playlistLoad: 'playlist:load',
  playlistSave: 'playlist:save',
  outputOpen: 'output:open'
} as const

// 后续所有的流数据交互、文件选择 IPC 通道都必须在此白名单中逐项暴露。
const api = {
  selectAudioFiles: () => ipcRenderer.invoke(ipcChannels.selectAudioFiles),
  selectImportFolder: () => ipcRenderer.invoke(ipcChannels.selectImportFolder),
  importDroppedFiles: (filePaths: string[]) => ipcRenderer.invoke(ipcChannels.importDroppedFiles, filePaths),
  selectOutputDirectory: () => ipcRenderer.invoke(ipcChannels.selectOutputDirectory),
  startConversion: (request: unknown) => ipcRenderer.invoke(ipcChannels.startConversion, request),
  savePlaylist: (tracks: unknown) => ipcRenderer.invoke(ipcChannels.playlistSave, tracks),
  loadPlaylist: () => ipcRenderer.invoke(ipcChannels.playlistLoad),
  openOutputDirectory: (directory: string) => ipcRenderer.invoke(ipcChannels.outputOpen, directory),
  onConversionUpdate: (callback: (update: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: unknown): void => callback(update)
    ipcRenderer.on(ipcChannels.conversionUpdate, listener)

    return () => ipcRenderer.removeListener(ipcChannels.conversionUpdate, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
}
