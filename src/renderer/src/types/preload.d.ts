export interface VolcanicApi {
  selectAudioFiles: () => Promise<string[]>
  selectImportFolder: () => Promise<string[]>
  selectOutputDirectory: () => Promise<string | null>
}

declare global {
  interface Window {
    api: VolcanicApi
  }
}

export {}
