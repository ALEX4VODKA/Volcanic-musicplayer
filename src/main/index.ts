// src/main/index.ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils' // 剔除不稳定的 electronApp 包装

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: "Volcanic Musicplayer",
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
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