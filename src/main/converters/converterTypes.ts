export type SupportedAudioExtension = 'mp3' | 'wav' | 'flac' | 'm4a' | 'aac' | 'ogg' | 'ncm' | 'kgm' | 'qmc'

export type ConversionStatus = 'waiting' | 'converting' | 'success' | 'failed' | 'unsupported'

export interface AudioFileEntry {
  id: string
  name: string
  path: string
  extension: SupportedAudioExtension
  sizeBytes: number
  sizeLabel: string
  playableUrl: string
}

export interface ConversionTask {
  id: string
  filePath: string
  fileName: string
  sourceFormat: SupportedAudioExtension
  targetFormat: 'MP3'
  outputDirectory: string
  outputPath: string | null
  status: ConversionStatus
  progress: number
  message: string
}

export interface ConversionSettings {
  bitrateKbps: 128 | 192 | 320
  skipExisting: boolean
}

export interface ConversionRequest {
  files: AudioFileEntry[]
  outputDirectory: string
  settings: ConversionSettings
}

export interface ConversionResult {
  tasks: ConversionTask[]
}

export interface ConversionUpdate {
  task: ConversionTask
}
