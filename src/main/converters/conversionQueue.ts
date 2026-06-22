import { access, copyFile, mkdir } from 'fs/promises'
import { basename, join, parse } from 'path'
import type {
  AudioFileEntry,
  ConversionRequest,
  ConversionResult,
  ConversionSettings,
  ConversionTask,
  ConversionUpdate
} from './converterTypes'
import { convertWithFfmpeg } from './ffmpegConverter'
import { decodePrivateContainer } from './proprietaryFormatGuard'
import { convertWavToMp3 } from './wavToMp3'

const privateContainers = new Set(['ncm', 'kgm', 'qmc'])
const defaultSettings: ConversionSettings = { bitrateKbps: 192, skipExisting: true }

function safeOutputName(fileName: string): string {
  return `${parse(fileName).name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')}.mp3`
}

function createTask(file: AudioFileEntry, outputDirectory: string): ConversionTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    filePath: file.path,
    fileName: file.name,
    sourceFormat: file.extension,
    targetFormat: 'MP3',
    outputDirectory,
    outputPath: join(outputDirectory, safeOutputName(file.name)),
    status: 'waiting',
    progress: 0,
    message: '等待处理'
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function runTask(
  task: ConversionTask,
  settings: ConversionSettings,
  notify: (update: ConversionUpdate) => void
): Promise<void> {
  const setTask = (patch: Partial<ConversionTask>): void => {
    Object.assign(task, patch)
    notify({ task: { ...task } })
  }

  if (!task.outputPath) {
    setTask({ status: 'failed', message: '输出位置无效' })
    return
  }

  await mkdir(task.outputDirectory, { recursive: true })

  if (settings.skipExisting && await fileExists(task.outputPath)) {
    setTask({ status: 'success', progress: 100, message: `已存在，跳过 ${basename(task.outputPath)}` })
    return
  }

  if (privateContainers.has(task.sourceFormat)) {
    setTask({ status: 'converting', progress: 3, message: '正在识别专属音乐文件' })
    const decoded = await decodePrivateContainer(
      task.filePath,
      task.fileName,
      task.sourceFormat,
      task.outputDirectory
    )

    setTask({ progress: 42, message: `已还原 ${decoded.detectedFormat.toUpperCase()} 音频` })

    if (decoded.detectedFormat === 'mp3') {
      await copyFile(decoded.outputPath, task.outputPath)
      setTask({ status: 'success', progress: 100, message: `已保存 ${basename(task.outputPath)}` })
      return
    }

    if (decoded.detectedFormat === 'wav') {
      await convertWavToMp3(decoded.outputPath, task.outputPath, settings.bitrateKbps, progress => {
        setTask({ progress: Math.max(45, progress), message: `正在生成 MP3 ${progress}%` })
      })
      setTask({ status: 'success', progress: 100, message: `已保存 ${basename(task.outputPath)}` })
      return
    }

    await convertWithFfmpeg(decoded.outputPath, task.outputPath, settings.bitrateKbps, progress => {
      setTask({ progress: Math.max(45, progress), message: `正在转换 ${progress}%` })
    })
    setTask({ status: 'success', progress: 100, message: `已保存 ${basename(task.outputPath)}` })
    return
  }

  setTask({ status: 'converting', progress: 1, message: '正在处理音频' })

  if (task.sourceFormat === 'mp3') {
    await copyFile(task.filePath, task.outputPath)
    setTask({ status: 'success', progress: 100, message: `已保存 ${basename(task.outputPath)}` })
    return
  }

  if (task.sourceFormat === 'wav') {
    await convertWavToMp3(task.filePath, task.outputPath, settings.bitrateKbps, progress => {
      setTask({ progress, message: `正在生成 MP3 ${progress}%` })
    })
    setTask({ status: 'success', progress: 100, message: `已保存 ${basename(task.outputPath)}` })
    return
  }

  await convertWithFfmpeg(task.filePath, task.outputPath, settings.bitrateKbps, progress => {
    setTask({ progress, message: `正在转换 ${progress}%` })
  })
  setTask({ status: 'success', progress: 100, message: `已保存 ${basename(task.outputPath)}` })
}

export async function runConversionQueue(
  request: ConversionRequest,
  notify: (update: ConversionUpdate) => void
): Promise<ConversionResult> {
  const tasks = request.files.map(file => createTask(file, request.outputDirectory))
  const settings = request.settings || defaultSettings
  tasks.forEach(task => notify({ task: { ...task } }))

  for (const task of tasks) {
    try {
      await runTask(task, settings, notify)
    } catch (error) {
      task.status = 'failed'
      task.progress = 0
      task.message = error instanceof Error ? error.message : '处理失败'
      notify({ task: { ...task } })
    }
  }

  return { tasks }
}

export function isSupportedAudioExtension(extension: string): extension is AudioFileEntry['extension'] {
  return ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'ncm', 'kgm', 'qmc'].includes(extension)
}
