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

export interface ConversionRequest {
  files: AudioFileEntry[]
  outputDirectory: string
}

export interface ConversionResult {
  tasks: ConversionTask[]
}

export interface ConversionUpdate {
  task: ConversionTask
}

export interface PlaylistTrack {
  id: string
  title: string
  artist: string
  duration: string
  sourcePath: string
  playableUrl: string
}

export interface PlaylistDocument {
  version: 1
  savedAt: string
  tracks: PlaylistTrack[]
}

export interface VolcanicApi {
  selectAudioFiles: () => Promise<AudioFileEntry[]>
  selectImportFolder: () => Promise<AudioFileEntry[]>
  importDroppedFiles: (filePaths: string[]) => Promise<AudioFileEntry[]>
  selectOutputDirectory: () => Promise<string | null>
  startConversion: (request: ConversionRequest) => Promise<ConversionResult>
  savePlaylist: (tracks: PlaylistTrack[]) => Promise<PlaylistDocument>
  loadPlaylist: () => Promise<PlaylistDocument>
  openOutputDirectory: (directory: string) => Promise<string | null>
  onConversionUpdate: (callback: (update: ConversionUpdate) => void) => () => void
}

declare global {
  interface Window {
    api: VolcanicApi
  }
}

export {}
