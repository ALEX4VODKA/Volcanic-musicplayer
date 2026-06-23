// src/main/index.ts
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readdir, stat } from 'fs/promises'
import { extname, join } from 'path'
import { pathToFileURL } from 'url'
import { optimizer, is } from '@electron-toolkit/utils' // 剔除不稳定的 electronApp 包装
import {
  isSupportedAudioExtension,
  runConversionQueue
} from './converters/conversionQueue'
import type {
  AudioFileEntry,
  ConversionRequest,
  ConversionUpdate
} from './converters/converterTypes'
import {
  loadPlaylist,
  savePlaylist,
  type PlaylistTrack
} from './playlist/playlistStore'

let mainWindow: BrowserWindow | null = null

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function createAudioEntry(filePath: string): Promise<AudioFileEntry | null> {
  const extension = extname(filePath).slice(1).toLowerCase()
  if (!isSupportedAudioExtension(extension)) return null

  const fileStat = await stat(filePath)
  if (!fileStat.isFile() || fileStat.size <= 0) return null

  return {
    id: `audio-${fileStat.mtimeMs}-${fileStat.size}-${filePath}`,
    name: filePath.split(/[\\/]/).pop() || filePath,
    path: filePath,
    extension,
    sizeBytes: fileStat.size,
    sizeLabel: formatSize(fileStat.size),
    playableUrl: pathToFileURL(filePath).toString()
  }
}

async function collectAudioFiles(directory: string): Promise<AudioFileEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: AudioFileEntry[] = []

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectAudioFiles(fullPath))
      continue
    }

    if (!entry.isFile()) continue

    const audioEntry = await createAudioEntry(fullPath)
    if (audioEntry) files.push(audioEntry)
  }

  return files
}

function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.selectAudioFiles, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择音频文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Supported audio containers',
          extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'ncm', 'kgm', 'qmc']
        }
      ]
    })

    if (result.canceled) return []

    const entries = await Promise.all(result.filePaths.map(filePath => createAudioEntry(filePath)))
    return entries.filter((entry): entry is AudioFileEntry => Boolean(entry))
  })

  ipcMain.handle(ipcChannels.selectImportFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择待导入音频文件夹',
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths[0]) return []

    return collectAudioFiles(result.filePaths[0])
  })

  ipcMain.handle(ipcChannels.importDroppedFiles, async (_event, filePaths: string[]) => {
    const entries = await Promise.all(filePaths.map(filePath => createAudioEntry(filePath)))
    return entries.filter((entry): entry is AudioFileEntry => Boolean(entry))
  })

  ipcMain.handle(ipcChannels.selectOutputDirectory, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择输出目录',
      properties: ['openDirectory', 'createDirectory']
    })

    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(ipcChannels.startConversion, async (_event, request: ConversionRequest) => {
    return runConversionQueue(request, (update: ConversionUpdate) => {
      mainWindow?.webContents.send(ipcChannels.conversionUpdate, update)
    })
  })

  ipcMain.handle(ipcChannels.playlistSave, async (_event, tracks: PlaylistTrack[]) => {
    return savePlaylist(tracks)
  })

  ipcMain.handle(ipcChannels.playlistLoad, async () => {
    return loadPlaylist()
  })

  ipcMain.handle(ipcChannels.outputOpen, async (_event, directory: string) => {
    if (!directory) return '输出目录为空'

    const result = await shell.openPath(directory)
    return result || null
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: "Volcanic Musicplayer",
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true, // 核心安全隔离
      nodeIntegration: false  // 禁用前端直接调用 Node
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // 核心修复：使用 Electron 原生 Windows 应用 ID 注册，100% 稳定可靠
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.volcanic.musicplayer')
  }

  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    try {
      optimizer.watchWindowShortcuts(window)
    } catch (e) {
      console.log('快捷键优化器跳过')
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
