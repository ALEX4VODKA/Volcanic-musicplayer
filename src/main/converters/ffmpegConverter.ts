import { spawn } from 'child_process'

function parseTimestamp(value: string): number {
  const match = value.match(/(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/)
  if (!match) return 0

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])

  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

function parseDuration(stderr: string): number {
  const match = stderr.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/)
  return match ? parseTimestamp(match[1]) : 0
}

function parseProgress(stderr: string, durationMs: number): number | null {
  if (durationMs <= 0) return null

  const matches = [...stderr.matchAll(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/g)]
  const latest = matches[matches.length - 1]
  if (!latest) return null

  return Math.min(98, Math.max(1, Math.round((parseTimestamp(latest[1]) / durationMs) * 100)))
}

export function convertWithFfmpeg(
  inputPath: string,
  outputPath: string,
  bitrateKbps: 128 | 192 | 320,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = process.env.FFMPEG_PATH || 'ffmpeg'
    const args = ['-y', '-i', inputPath, '-vn', '-codec:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, outputPath]
    const child = spawn(command, args, { shell: false, windowsHide: true })
    let stderr = ''
    let durationMs = 0

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
      if (durationMs === 0) durationMs = parseDuration(stderr)
      const progress = parseProgress(stderr, durationMs)
      if (progress !== null) onProgress(progress)
    })

    child.on('error', error => {
      reject(new Error(error.message.includes('ENOENT')
        ? '这个格式需要完整转码引擎。轻量版无需安装即可处理 MP3、WAV 和可识别的 NCM/QMC/KGM。'
        : error.message))
    })

    child.on('exit', code => {
      if (code === 0) {
        onProgress(100)
        resolve()
        return
      }

      reject(new Error(`FFmpeg 转换失败，退出码 ${code ?? 'unknown'}`))
    })
  })
}
