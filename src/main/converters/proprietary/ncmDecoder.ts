import { createDecipheriv } from 'crypto'
import { readFile } from 'fs/promises'

const ncmMagic = Buffer.from([0x43, 0x54, 0x45, 0x4e, 0x46, 0x44, 0x41, 0x4d])
const coreKey = Buffer.from('hzHRAmso5kInbaxW', 'utf8')

function decryptAesEcb(data: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv('aes-128-ecb', key, null)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

function buildKeyBox(keyData: Buffer): Uint8Array {
  const keyBox = new Uint8Array(256)

  for (let i = 0; i < 256; i += 1) keyBox[i] = i

  let lastByte = 0
  let keyOffset = 0

  for (let i = 0; i < 256; i += 1) {
    const swap = keyBox[i]
    const c = (swap + lastByte + keyData[keyOffset]) & 0xff
    keyOffset = (keyOffset + 1) % keyData.length
    keyBox[i] = keyBox[c]
    keyBox[c] = swap
    lastByte = c
  }

  return keyBox
}

function applyNcmKeyStream(data: Buffer, keyBox: Uint8Array): Buffer {
  const output = Buffer.from(data)

  for (let i = 0; i < output.length; i += 1) {
    const j = (i + 1) & 0xff
    output[i] ^= keyBox[(keyBox[j] + keyBox[(keyBox[j] + j) & 0xff]) & 0xff]
  }

  return output
}

export async function decodeNcmContainer(inputPath: string): Promise<Buffer> {
  const buffer = await readFile(inputPath)

  if (!buffer.subarray(0, 8).equals(ncmMagic)) {
    throw new Error('NCM 魔数校验失败')
  }

  let offset = 10
  const keyLength = buffer.readUInt32LE(offset)
  offset += 4

  const encryptedKey = Buffer.from(buffer.subarray(offset, offset + keyLength))
  offset += keyLength

  for (let i = 0; i < encryptedKey.length; i += 1) encryptedKey[i] ^= 0x64

  const decryptedKey = decryptAesEcb(encryptedKey, coreKey).subarray(17)
  if (decryptedKey.length === 0) throw new Error('NCM 音频密钥为空')

  const keyBox = buildKeyBox(decryptedKey)
  const metadataLength = buffer.readUInt32LE(offset)
  offset += 4 + metadataLength

  const crcAndGapLength = 9
  offset += crcAndGapLength

  const imageSize = buffer.readUInt32LE(offset)
  offset += 4 + imageSize

  if (offset >= buffer.length) throw new Error('NCM 音频负荷为空')

  return applyNcmKeyStream(buffer.subarray(offset), keyBox)
}
