import React, { useEffect, useMemo, useRef, useState } from 'react'
import './styles/app.css'
import type {
  AudioFileEntry,
  ConversionStatus,
  ConversionTask,
  ConversionUpdate,
  PlaylistTrack
} from './types/preload'

type NoticeKind = 'info' | 'success' | 'warning' | 'error'

interface Notice {
  text: string
  kind: NoticeKind
}

const defaultOutputDir = 'D:\\Music\\Volcanic-Output'

function fileTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function pathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `file://${encodeURI(prefixed)}`
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function statusLabel(status: ConversionStatus): string {
  const labels: Record<ConversionStatus, string> = {
    waiting: '等待',
    converting: '转换中',
    success: '完成',
    failed: '失败',
    unsupported: '不支持'
  }

  return labels[status]
}

function createPlaylistTrack(file: AudioFileEntry): PlaylistTrack {
  return {
    id: `track-${file.id}`,
    title: fileTitle(file.name),
    artist: file.extension.toUpperCase(),
    duration: '待解析',
    sourcePath: file.path,
    playableUrl: file.playableUrl
  }
}

function createWaitingTask(file: AudioFileEntry, outputDirectory: string): ConversionTask {
  return {
    id: `pending-${file.id}`,
    filePath: file.path,
    fileName: file.name,
    sourceFormat: file.extension,
    targetFormat: 'MP3',
    outputDirectory,
    outputPath: null,
    status: 'waiting',
    progress: 0,
    message: '等待转换'
  }
}

function App(): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [library, setLibrary] = useState<AudioFileEntry[]>([])
  const [tasks, setTasks] = useState<ConversionTask[]>([])
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([])
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState(defaultOutputDir)
  const [notice, setNotice] = useState<Notice>({ text: '准备导入音频资产', kind: 'info' })
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)
  const [isConverting, setIsConverting] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const currentTrack = useMemo(
    () => playlist.find(track => track.id === currentTrackId) || playlist[0] || null,
    [currentTrackId, playlist]
  )

  const completedCount = tasks.filter(task => task.status === 'success').length
  const failedCount = tasks.filter(task => task.status === 'failed' || task.status === 'unsupported').length
  const waitingCount = tasks.filter(task => task.status === 'waiting').length
  const progressAverage = tasks.length === 0
    ? 0
    : Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)

  useEffect(() => {
    const unsubscribe = window.api.onConversionUpdate((update: ConversionUpdate) => {
      setTasks(current => {
        const index = current.findIndex(task => task.id === update.task.id)
        if (index === -1) return [update.task, ...current]
        const next = [...current]
        next[index] = update.task
        return next
      })

      if (update.task.status === 'success' && update.task.outputPath) {
        const convertedTrack: PlaylistTrack = {
          id: `converted-${update.task.id}`,
          title: fileTitle(update.task.fileName),
          artist: 'MP3 输出',
          duration: '待解析',
          sourcePath: update.task.outputPath,
          playableUrl: pathToFileUrl(update.task.outputPath)
        }

        setPlaylist(current => {
          if (current.some(track => track.sourcePath === convertedTrack.sourcePath)) return current
          return [...current, convertedTrack]
        })
        setNotice({ text: `${update.task.fileName} 已输出到指定目录`, kind: 'success' })
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!currentTrackId && playlist.length > 0) {
      setCurrentTrackId(playlist[0].id)
    }
  }, [currentTrackId, playlist])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const addEntries = (entries: AudioFileEntry[]): void => {
    if (entries.length === 0) {
      setNotice({ text: '没有发现可导入的支持格式文件', kind: 'warning' })
      return
    }

    setLibrary(current => {
      const existing = new Set(current.map(file => file.path))
      return [...current, ...entries.filter(file => !existing.has(file.path))]
    })
    setTasks(current => {
      const existing = new Set(current.map(task => task.filePath))
      const nextTasks = entries
        .filter(file => !existing.has(file.path))
        .map(file => createWaitingTask(file, outputDir))
      return [...nextTasks, ...current]
    })
    setPlaylist(current => {
      const existing = new Set(current.map(track => track.sourcePath))
      return [...current, ...entries.filter(file => !existing.has(file.path)).map(createPlaylistTrack)]
    })
    setNotice({ text: `已导入 ${entries.length} 个音频文件`, kind: 'success' })
  }

  const selectFiles = async (): Promise<void> => {
    try {
      addEntries(await window.api.selectAudioFiles())
    } catch {
      setNotice({ text: '文件导入失败', kind: 'error' })
    }
  }

  const selectFolder = async (): Promise<void> => {
    try {
      addEntries(await window.api.selectImportFolder())
    } catch {
      setNotice({ text: '文件夹导入失败', kind: 'error' })
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLElement>): Promise<void> => {
    event.preventDefault()
    setDragActive(false)

    const filePaths = Array.from(event.dataTransfer.files)
      .map(file => (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path))

    if (filePaths.length === 0) {
      setNotice({ text: '拖拽文件缺少本地路径，无法导入', kind: 'warning' })
      return
    }

    try {
      addEntries(await window.api.importDroppedFiles(filePaths))
    } catch {
      setNotice({ text: '拖拽导入失败', kind: 'error' })
    }
  }

  const chooseOutputDir = async (): Promise<void> => {
    const selected = await window.api.selectOutputDirectory()
    if (!selected) return
    setOutputDir(selected)
    setTasks(current => current.map(task => ({ ...task, outputDirectory: selected })))
    setNotice({ text: '输出目录已更新', kind: 'success' })
  }

  const startConversion = async (onlyFailed = false): Promise<void> => {
    const candidatePaths = new Set(
      tasks
        .filter(task => onlyFailed ? task.status === 'failed' || task.status === 'unsupported' : task.status !== 'success')
        .map(task => task.filePath)
    )
    const files = library.filter(file => candidatePaths.has(file.path))

    if (files.length === 0) {
      setNotice({ text: onlyFailed ? '没有可重试的失败任务' : '没有待转换任务', kind: 'warning' })
      return
    }

    setIsConverting(true)
    setNotice({ text: `开始转换 ${files.length} 个任务`, kind: 'info' })

    try {
      await window.api.startConversion({ files, outputDirectory: outputDir })
      setNotice({ text: '转换队列执行完成', kind: 'success' })
    } catch {
      setNotice({ text: '转换队列启动失败', kind: 'error' })
    } finally {
      setIsConverting(false)
    }
  }

  const clearCompleted = (): void => {
    setTasks(current => current.filter(task => task.status !== 'success'))
    setNotice({ text: '已清空完成任务', kind: 'info' })
  }

  const openOutputDir = async (): Promise<void> => {
    const result = await window.api.openOutputDirectory(outputDir)
    setNotice(result ? { text: result, kind: 'error' } : { text: '已打开输出目录', kind: 'success' })
  }

  const savePlaylist = async (): Promise<void> => {
    await window.api.savePlaylist(playlist)
    setNotice({ text: 'playlist.json 已保存', kind: 'success' })
  }

  const loadPlaylist = async (): Promise<void> => {
    const document = await window.api.loadPlaylist()
    setPlaylist(document.tracks)
    setCurrentTrackId(document.tracks[0]?.id || null)
    setNotice({ text: `已读取 ${document.tracks.length} 首播放列表曲目`, kind: 'success' })
  }

  const clearPlaylist = (): void => {
    setPlaylist([])
    setCurrentTrackId(null)
    setIsPlaying(false)
    setNotice({ text: '播放列表已清空', kind: 'info' })
  }

  const removeTrack = (id: string): void => {
    setPlaylist(current => current.filter(track => track.id !== id))
    if (id === currentTrackId) setCurrentTrackId(null)
  }

  const moveTrack = (index: number, direction: -1 | 1): void => {
    setPlaylist(current => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const moving = next[index]
      next[index] = next[target]
      next[target] = moving
      return next
    })
  }

  const playTrack = async (track: PlaylistTrack): Promise<void> => {
    setCurrentTrackId(track.id)
    requestAnimationFrame(() => {
      audioRef.current?.play()
        .then(() => setIsPlaying(true))
        .catch(() => setNotice({ text: '当前文件无法播放，请尝试转换后的 MP3', kind: 'warning' }))
    })
  }

  const togglePlayback = async (): Promise<void> => {
    if (!currentTrack || !audioRef.current) {
      setNotice({ text: '请先选择播放列表曲目', kind: 'warning' })
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch {
      setNotice({ text: '当前文件无法播放，请尝试转换后的 MP3', kind: 'warning' })
    }
  }

  const selectRelativeTrack = (direction: -1 | 1): void => {
    if (playlist.length === 0) return
    const currentIndex = Math.max(0, playlist.findIndex(track => track.id === currentTrackId))
    const target = (currentIndex + direction + playlist.length) % playlist.length
    void playTrack(playlist[target])
  }

  const seek = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value)
    if (audioRef.current) audioRef.current.currentTime = next
    setCurrentTime(next)
  }

  return (
    <div className="app-shell">
      <audio
        ref={audioRef}
        src={currentTrack?.playableUrl || undefined}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => selectRelativeTrack(1)}
      />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <h1>Volcanic</h1>
            <span>Musicplayer</span>
          </div>
        </div>

        <section
          className={`drop-zone ${dragActive ? 'drop-zone-active' : ''}`}
          onDragOver={event => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={selectFiles}
        >
          <div className="drop-icon">+</div>
          <strong>拖拽或点击导入</strong>
          <span>MP3 / WAV 可直接处理，其他格式等待 FFmpeg 接入</span>
        </section>

        <div className="button-stack">
          <button className="primary-button" onClick={selectFiles}>选择音频文件</button>
          <button className="secondary-button" onClick={selectFolder}>扫描文件夹</button>
          <button className="secondary-button" onClick={loadPlaylist}>读取 playlist.json</button>
          <button className="secondary-button" onClick={savePlaylist}>保存 playlist.json</button>
        </div>

        <section className="output-panel">
          <span>输出目录</span>
          <strong title={outputDir}>{outputDir}</strong>
          <div className="output-actions">
            <button onClick={chooseOutputDir}>更改</button>
            <button onClick={openOutputDir}>打开</button>
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="hero-panel">
          <div>
            <span className="eyebrow">Local stream restoration</span>
            <h2>转换、整理和播放都在一个工作台完成</h2>
            <p>导入后进入异步转换队列，成功输出的 MP3 会自动追加到播放列表。</p>
          </div>
          <div className={`notice notice-${notice.kind}`}>{notice.text}</div>
        </header>

        <section className="metric-grid">
          <div><span>资产</span><strong>{library.length}</strong></div>
          <div><span>等待</span><strong>{waitingCount}</strong></div>
          <div><span>完成</span><strong>{completedCount}</strong></div>
          <div><span>失败/阻止</span><strong>{failedCount}</strong></div>
          <div><span>总进度</span><strong>{progressAverage}%</strong></div>
        </section>

        <section className="queue-panel">
          <div className="section-header">
            <div>
              <span>Conversion Queue</span>
              <h3>MP3 输出队列</h3>
            </div>
            <div className="toolbar">
              <button onClick={() => void startConversion(false)} disabled={isConverting}>全部转换</button>
              <button onClick={() => void startConversion(true)} disabled={isConverting}>重试失败</button>
              <button onClick={clearCompleted}>清空完成</button>
            </div>
          </div>

          <div className="queue-list">
            {tasks.length === 0 && <div className="empty-state">还没有任务。导入音频后会自动出现在这里。</div>}
            {tasks.map(task => (
              <article className="queue-row" key={task.id}>
                <div className="file-cell">
                  <strong>{task.fileName}</strong>
                  <span>{task.sourceFormat.toUpperCase()} → MP3</span>
                </div>
                <div className="progress-cell">
                  <div className="progress-track">
                    <div className={`progress-fill progress-${task.status}`} style={{ width: `${task.progress}%` }} />
                  </div>
                  <span>{task.message}</span>
                </div>
                <span className={`status-badge status-${task.status}`}>{statusLabel(task.status)}</span>
              </article>
            ))}
          </div>
        </section>
      </main>

      <aside className="playlist-panel">
        <div className="section-header">
          <div>
            <span>Playlist</span>
            <h3>播放列表</h3>
          </div>
          <button onClick={clearPlaylist}>清空</button>
        </div>

        <div className="playlist-list">
          {playlist.length === 0 && <div className="empty-state">播放列表为空。导入或转换成功后可播放。</div>}
          {playlist.map((track, index) => (
            <article
              className={`track-row ${track.id === currentTrack?.id ? 'track-active' : ''}`}
              key={track.id}
              onDoubleClick={() => void playTrack(track)}
              onClick={() => setCurrentTrackId(track.id)}
            >
              <button className="track-play" onClick={() => void playTrack(track)}>
                {track.id === currentTrack?.id && isPlaying ? 'Ⅱ' : '▶'}
              </button>
              <div className="track-copy">
                <strong>{track.title}</strong>
                <span>{track.artist} · {track.duration}</span>
              </div>
              <div className="track-actions">
                <button disabled={index === 0} onClick={() => moveTrack(index, -1)}>↑</button>
                <button disabled={index === playlist.length - 1} onClick={() => moveTrack(index, 1)}>↓</button>
                <button onClick={() => removeTrack(track.id)}>×</button>
              </div>
            </article>
          ))}
        </div>
      </aside>

      <footer className="player-bar">
        <div className="now-playing">
          <div className="cover-art">♪</div>
          <div>
            <strong>{currentTrack?.title || '未选择曲目'}</strong>
            <span>{currentTrack?.artist || 'Volcanic Musicplayer'}</span>
          </div>
        </div>

        <div className="transport">
          <div className="transport-buttons">
            <button onClick={() => selectRelativeTrack(-1)}>⏮</button>
            <button className="play-button" onClick={() => void togglePlayback()}>{isPlaying ? 'Ⅱ' : '▶'}</button>
            <button onClick={() => selectRelativeTrack(1)}>⏭</button>
          </div>
          <div className="scrubber">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min="0" max={duration || 0} value={Math.min(currentTime, duration || 0)} onChange={seek} />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="volume-control">
          <span>音量</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={event => setVolume(Number(event.target.value))}
          />
        </div>
      </footer>
    </div>
  )
}

export default App
