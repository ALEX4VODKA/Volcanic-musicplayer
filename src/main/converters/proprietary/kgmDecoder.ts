import { readFile } from 'fs/promises'

const kgmHeader = Buffer.from([
  0x7c, 0xd5, 0x32, 0xeb, 0x86, 0x02, 0x7f, 0x4b,
  0xa8, 0xaf, 0xa6, 0x8e, 0x0f, 0xff, 0x99, 0x14
])

const vprHeader = Buffer.from([
  0x05, 0x28, 0xbc, 0x96, 0xe9, 0xe4, 0x5a, 0x43,
  0x91, 0xaa, 0xbd, 0xd0, 0x7a, 0xf5, 0x36, 0x31
])

const baseMask = Uint8Array.from([
  0xac, 0xec, 0xdf, 0x57, 0xa5, 0x55, 0xbd, 0x45,
  0x35, 0xc0, 0x1d, 0x74, 0x37, 0x2c, 0x4f, 0x5f,
  0xd4, 0x4e, 0xa9, 0x5b, 0x25, 0x79, 0x21, 0x70,
  0x5d, 0x5f, 0x4b, 0x9b, 0x29, 0x13, 0x6f, 0x4b
])

function kgmMaskAt(position: number): number {
  const round = Math.floor(position / baseMask.length)
  const index = position % baseMask.length
  return baseMask[index] ^ ((round * 31 + index * 17 + 0x63) & 0xff)
}

export async function decodeKgmContainer(inputPath: string): Promise<Buffer> {
  const input = await readFile(inputPath)
  const isKgm = input.subarray(0, kgmHeader.length).equals(kgmHeader)
  const isVpr = input.subarray(0, vprHeader.length).equals(vprHeader)

  if (!isKgm && !isVpr) {
    throw new Error('KGM/VPR 魔数校验失败')
  }

  const payloadOffset = 1024
  if (input.length <= payloadOffset) throw new Error('KGM 音频负荷为空')

  const payload = Buffer.from(input.subarray(payloadOffset))

  for (let i = 0; i < payload.length; i += 1) {
    payload[i] ^= kgmMaskAt(i)
  }

  return payload
}
