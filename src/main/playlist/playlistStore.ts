import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { app } from 'electron'

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

function getPlaylistPath(): string {
  return join(app.getPath('userData'), 'playlist.json')
}

export async function savePlaylist(tracks: PlaylistTrack[]): Promise<PlaylistDocument> {
  const document: PlaylistDocument = {
    version: 1,
    savedAt: new Date().toISOString(),
    tracks
  }
  const playlistPath = getPlaylistPath()

  await mkdir(dirname(playlistPath), { recursive: true })
  await writeFile(playlistPath, JSON.stringify(document, null, 2), 'utf8')

  return document
}

export async function loadPlaylist(): Promise<PlaylistDocument> {
  try {
    const raw = await readFile(getPlaylistPath(), 'utf8')
    const parsed = JSON.parse(raw) as PlaylistDocument

    if (!Array.isArray(parsed.tracks)) {
      throw new Error('playlist.json 格式无效')
    }

    return parsed
  } catch {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      tracks: []
    }
  }
}
