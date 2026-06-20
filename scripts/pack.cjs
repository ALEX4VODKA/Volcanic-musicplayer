const { spawn } = require('node:child_process')
const { mkdirSync } = require('node:fs')
const { join, resolve } = require('node:path')

const root = resolve(__dirname, '..')
const electronCache = join(root, '.cache', 'electron')
const builderCache = join(root, '.cache', 'electron-builder')
const builderCli = join(root, 'node_modules', 'electron-builder', 'cli.js')
const args = process.argv.slice(2)

mkdirSync(electronCache, { recursive: true })
mkdirSync(builderCache, { recursive: true })

const child = spawn(process.execPath, [builderCli, ...args], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    ELECTRON_CACHE: electronCache,
    ELECTRON_BUILDER_CACHE: builderCache,
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR:
      process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
      'https://npmmirror.com/mirrors/electron-builder-binaries/'
  }
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`electron-builder terminated by ${signal}`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
