import { readFile, writeFile } from 'fs/promises'
import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'

interface WavData {
  sampleRate: number
  channels: number
  bitsPerSample: number
  pcm: Buffer
}

interface Mp3Encoder {
  encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array
  flush(): Uint8Array
}

interface LameRuntime {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => Mp3Encoder
}

let lameRuntime: LameRuntime | null = null

function loadLameRuntime(): LameRuntime {
  if (lameRuntime) return lameRuntime

  const source = `${readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8')}\nmodule.exports = lamejs;`
  const sandbox = { module: { exports: {} as LameRuntime }, exports: {} }
  runInNewContext(source, sandbox)
  lameRuntime = sandbox.module.exports

  return lameRuntime
}

function readAscii(buffer: Buffer, offset: number, length: number): string {
  return buffer.toString('ascii', offset, offset + length)
}

function parseWav(buffer: Buffer): WavData {
  if (readAscii(buffer, 0, 4) !== 'RIFF' || readAscii(buffer, 8, 4) !== 'WAVE') {
    throw new Error('不是有效的 WAV 文件')
  }

  let offset = 12
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let audioFormat = 0
  let pcm: Buffer | null = null

  while (offset + 8 <= buffer.length) {
    const chunkId = readAscii(buffer, offset, 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const dataOffset = offset + 8

    if (chunkId === 'fmt ') {
      audioFormat = buffer.readUInt16LE(dataOffset)
      channels = buffer.readUInt16LE(dataOffset + 2)
      sampleRate = buffer.readUInt32LE(dataOffset + 4)
      bitsPerSample = buffer.readUInt16LE(dataOffset + 14)
    }

    if (chunkId === 'data') {
      pcm = buffer.subarray(dataOffset, dataOffset + chunkSize)
    }

    offset = dataOffset + chunkSize + (chunkSize % 2)
  }

  if (audioFormat !== 1) throw new Error('当前仅支持 PCM WAV 转 MP3')
  if (channels !== 1 && channels !== 2) throw new Error('当前仅支持单声道或双声道 WAV')
  if (bitsPerSample !== 16) throw new Error('当前仅支持 16-bit PCM WAV')
  if (!pcm || sampleRate <= 0) throw new Error('WAV 音频数据不完整')

  return { sampleRate, channels, bitsPerSample, pcm }
}

function splitPcmChannels(pcm: Buffer, channels: number): { left: Int16Array; right?: Int16Array } {
  const sampleCount = Math.floor(pcm.length / 2 / channels)
  const left = new Int16Array(sampleCount)
  const right = channels === 2 ? new Int16Array(sampleCount) : undefined

  for (let i = 0; i < sampleCount; i += 1) {
    left[i] = pcm.readInt16LE(i * channels * 2)
    if (right) right[i] = pcm.readInt16LE(i * channels * 2 + 2)
  }

  return { left, right }
}

export async function convertWavToMp3(
  inputPath: string,
  outputPath: string,
  bitrateKbps: 128 | 192 | 320,
  onProgress: (progress: number) => void
): Promise<void> {
  const wav = parseWav(await readFile(inputPath))
  const { left, right } = splitPcmChannels(wav.pcm, wav.channels)
  const encoder = new (loadLameRuntime().Mp3Encoder)(wav.channels, wav.sampleRate, bitrateKbps)
  const mp3Chunks: Buffer[] = []
  const blockSize = 1152

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const leftChunk = left.subarray(offset, offset + blockSize)
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + blockSize))
      : encoder.encodeBuffer(leftChunk)

    if (encoded.length > 0) mp3Chunks.push(Buffer.from(encoded))
    onProgress(Math.min(98, Math.round((offset / left.length) * 100)))
  }

  const flush = encoder.flush()
  if (flush.length > 0) mp3Chunks.push(Buffer.from(flush))

  await writeFile(outputPath, Buffer.concat(mp3Chunks))
  onProgress(100)
}
