import { copyFile, mkdir } from 'fs/promises'
import { basename, join, parse } from 'path'
import type {
  AudioFileEntry,
  ConversionRequest,
  ConversionResult,
  ConversionTask,
  ConversionUpdate
} from './converterTypes'
import { convertWithFfmpeg } from './ffmpegConverter'
import { decodePrivateContainer } from './proprietaryFormatGuard'
import { convertWavToMp3 } from './wavToMp3'

const privateContainers = new Set(['ncm', 'kgm', 'qmc'])

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
    message: '等待转换'
  }
}

async function runTask(task: ConversionTask, notify: (update: ConversionUpdate) => void): Promise<void> {
  const setTask = (patch: Partial<ConversionTask>): void => {
    Object.assign(task, patch)
    notify({ task: { ...task } })
  }

  if (privateContainers.has(task.sourceFormat)) {
    setTask({ status: 'converting', progress: 3, message: '正在解包私有容器' })
    const decoded = await decodePrivateContainer(
      task.filePath,
      task.fileName,
      task.sourceFormat,
      task.outputDirectory
    )

    setTask({ progress: 42, message: `已还原 ${decoded.detectedFormat.toUpperCase()} 音频负荷` })

    if (decoded.detectedFormat === 'mp3') {
      if (!task.outputPath) throw new Error('输出路径无效')
      await copyFile(decoded.outputPath, task.outputPath)
      setTask({ status: 'success', progress: 100, message: `已输出 ${basename(task.outputPath)}` })
      return
    }

    if (decoded.detectedFormat === 'wav') {
      if (!task.outputPath) throw new Error('输出路径无效')
      await convertWavToMp3(decoded.outputPath, task.outputPath, progress => {
        setTask({ progress: Math.max(45, progress), message: `正在编码 ${progress}%` })
      })
      setTask({ status: 'success', progress: 100, message: `已输出 ${basename(task.outputPath)}` })
      return
    }

    if (!task.outputPath) throw new Error('输出路径无效')
    await convertWithFfmpeg(decoded.outputPath, task.outputPath, progress => {
      setTask({ progress: Math.max(45, progress), message: `FFmpeg 转码 ${progress}%` })
    })
    setTask({ status: 'success', progress: 100, message: `已输出 ${basename(task.outputPath)}` })
    return
  }

  if (!task.outputPath) {
    setTask({ status: 'failed', message: '输出路径无效' })
    return
  }

  await mkdir(task.outputDirectory, { recursive: true })
  setTask({ status: 'converting', progress: 1, message: '正在写入 MP3' })

  if (task.sourceFormat === 'mp3') {
    await copyFile(task.filePath, task.outputPath)
    setTask({ status: 'success', progress: 100, message: `已输出 ${basename(task.outputPath)}` })
    return
  }

  if (task.sourceFormat === 'wav') {
    await convertWavToMp3(task.filePath, task.outputPath, progress => {
      setTask({ progress, message: `正在编码 ${progress}%` })
    })
    setTask({ status: 'success', progress: 100, message: `已输出 ${basename(task.outputPath)}` })
    return
  }

  await convertWithFfmpeg(task.filePath, task.outputPath, progress => {
    setTask({ progress, message: `FFmpeg 转码 ${progress}%` })
  })
  setTask({ status: 'success', progress: 100, message: `已输出 ${basename(task.outputPath)}` })
}

export async function runConversionQueue(
  request: ConversionRequest,
  notify: (update: ConversionUpdate) => void
): Promise<ConversionResult> {
  const tasks = request.files.map(file => createTask(file, request.outputDirectory))
  tasks.forEach(task => notify({ task: { ...task } }))

  for (const task of tasks) {
    try {
      await runTask(task, notify)
    } catch (error) {
      task.status = 'failed'
      task.progress = 0
      task.message = error instanceof Error ? error.message : '转换失败'
      notify({ task: { ...task } })
    }
  }

  return { tasks }
}

export function isSupportedAudioExtension(extension: string): extension is AudioFileEntry['extension'] {
  return ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'ncm', 'kgm', 'qmc'].includes(extension)
}
