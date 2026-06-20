import { mkdir, writeFile } from 'fs/promises'
import { join, parse } from 'path'
import { decodeKgmContainer } from './proprietary/kgmDecoder'
import { decodeNcmContainer } from './proprietary/ncmDecoder'
import { decodeQmcContainer } from './proprietary/qmcDecoder'
import type { SupportedAudioExtension } from './converterTypes'

export interface DecodedContainer {
  sourceFormat: SupportedAudioExtension
  detectedFormat: 'mp3' | 'flac' | 'wav' | 'unknown'
  outputPath: string
}

function detectAudioFormat(buffer: Buffer): DecodedContainer['detectedFormat'] {
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'mp3'
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3'
  if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') return 'flac'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
    return 'wav'
  }
  return 'unknown'
}

function extensionForFormat(format: DecodedContainer['detectedFormat']): string {
  return format === 'unknown' ? 'bin' : format
}

function safeStem(fileName: string): string {
  return parse(fileName).name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
}

export async function decodePrivateContainer(
  inputPath: string,
  fileName: string,
  sourceFormat: SupportedAudioExtension,
  outputDirectory: string
): Promise<DecodedContainer> {
  let payload: Buffer

  if (sourceFormat === 'ncm') {
    payload = await decodeNcmContainer(inputPath)
  } else if (sourceFormat === 'qmc') {
    payload = await decodeQmcContainer(inputPath)
  } else if (sourceFormat === 'kgm') {
    payload = await decodeKgmContainer(inputPath)
  } else {
    throw new Error(`不支持的私有容器类型：${sourceFormat}`)
  }

  const detectedFormat = detectAudioFormat(payload)
  if (detectedFormat === 'unknown') {
    throw new Error('解包完成但未识别出 MP3/FLAC/WAV 音频负荷')
  }

  const tempDir = join(outputDirectory, '.volcanic-temp')
  const outputPath = join(tempDir, `${safeStem(fileName)}.decoded.${extensionForFormat(detectedFormat)}`)

  await mkdir(tempDir, { recursive: true })
  await writeFile(outputPath, payload)

  return {
    sourceFormat,
    detectedFormat,
    outputPath
  }
}
