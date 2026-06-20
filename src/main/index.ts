// src/main/index.ts
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils' // 剔除不稳定的 electronApp 包装

const supportedExtensions = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.ncm', '.kgm', '.qmc'])

const ipcChannels = {
  selectAudioFiles: 'dialog:select-audio-files',
  selectImportFolder: 'dialog:select-import-folder',
  selectOutputDirectory: 'dialog:select-output-directory'
} as const

async function collectAudioFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectAudioFiles(fullPath))
      continue
    }

    if (!entry.isFile()) continue

    const dotIndex = entry.name.lastIndexOf('.')
    const extension = dotIndex >= 0 ? entry.name.slice(dotIndex).toLowerCase() : ''

    if (!supportedExtensions.has(extension)) continue

    const fileStat = await stat(fullPath)
    if (fileStat.size > 0) files.push(fullPath)
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

    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(ipcChannels.selectImportFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择待导入音频文件夹',
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths[0]) return []

    return collectAudioFiles(result.filePaths[0])
  })

  ipcMain.handle(ipcChannels.selectOutputDirectory, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择输出目录',
      properties: ['openDirectory', 'createDirectory']
    })

    return result.canceled ? null : result.filePaths[0]
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: "Volcanic Musicplayer",
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true, // 核心安全隔离
      nodeIntegration: false  // 禁用前端直接调用 Node
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
