import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Disc3,
  FileAudio2,
  FolderOpen,
  HardDrive,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Save,
  ScanLine,
  Shuffle,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  X
} from 'lucide-react'
import './styles/app.css'
import type {
  AudioFileEntry,
  ConversionSettings,
  ConversionStatus,
  ConversionTask,
  ConversionUpdate,
  PlaylistTrack
} from './types/preload'

type NoticeKind = 'info' | 'success' | 'warning' | 'error'
type PlayMode = 'order' | 'repeat' | 'shuffle'

interface Notice {
  text: string
  kind: NoticeKind
}

interface UserSettings extends ConversionSettings {
  autoConvert: boolean
  notifyOnDone: boolean
}

const defaultOutputDir = 'D:\\Music\\Volcanic-Output'
const defaultSettings: UserSettings = {
  bitrateKbps: 192,
  skipExisting: true,
  autoConvert: false,
  notifyOnDone: true
}

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
    waiting: '待处理',
    converting: '处理中',
    success: '已完成',
    failed: '未完成',
    unsupported: '不支持'
  }

  return labels[status]
}

function createPlaylistTrack(file: AudioFileEntry): PlaylistTrack {
  return {
    id: `track-${file.id}`,
    title: fileTitle(file.name),
    artist: `${file.extension.toUpperCase()} 文件`,
    duration: '待识别',
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
    message: '等待处理'
  }
}

function loadSettings(): UserSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('volcanic-settings') || '{}') }
  } catch {
    return defaultSettings
  }
}

function playDoneSound(): void {
  const context = new AudioContext()
  const gain = context.createGain()
  const first = context.createOscillator()
  const second = context.createOscillator()

  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42)

  first.frequency.value = 660
  second.frequency.value = 990
  first.connect(gain)
  second.connect(gain)
  gain.connect(context.destination)
  first.start()
  second.start(context.currentTime + 0.08)
  first.stop(context.currentTime + 0.22)
  second.stop(context.currentTime + 0.42)
}

function App(): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceCreatedRef = useRef(false)

  const [library, setLibrary] = useState<AudioFileEntry[]>([])
  const [tasks, setTasks] = useState<ConversionTask[]>([])
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([])
  const [recentPlayed, setRecentPlayed] = useState<PlaylistTrack[]>([])
  const [recentConverted, setRecentConverted] = useState<ConversionTask[]>([])
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState(defaultOutputDir)
  const [notice, setNotice] = useState<Notice>({ text: '选择文件夹后，可以一键整理成 MP3。', kind: 'info' })
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const [playMode, setPlayMode] = useState<PlayMode>('order')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.75)
  const [isConverting, setIsConverting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [dragTrackId, setDragTrackId] = useState<string | null>(null)
  const [miniVisible, setMiniVisible] = useState(false)

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
    localStorage.setItem('volcanic-settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const unsubscribe = window.api.onConversionUpdate((update: ConversionUpdate) => {
      setTasks(current => {
        const index = current.findIndex(task => task.id === update.task.id)
        if (index === -1) return [update.task, ...current]
        const next = [...current]
        next[index] = update.task
        return next
      })

      if (update.task.status === 'success' || update.task.status === 'failed' || update.task.status === 'unsupported') {
        setRecentConverted(current => [update.task, ...current.filter(task => task.filePath !== update.task.filePath)].slice(0, 8))
      }

      if (update.task.status === 'success' && update.task.outputPath) {
        const convertedTrack: PlaylistTrack = {
          id: `converted-${update.task.id}`,
          title: fileTitle(update.task.fileName),
          artist: '整理后的 MP3',
          duration: '待识别',
          sourcePath: update.task.outputPath,
          playableUrl: pathToFileUrl(update.task.outputPath)
        }

        setPlaylist(current => {
          if (current.some(track => track.sourcePath === convertedTrack.sourcePath)) return current
          return [...current, convertedTrack]
        })
        setNotice({ text: `${update.task.fileName} 已整理完成。`, kind: 'success' })
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!currentTrackId && playlist.length > 0) setCurrentTrackId(playlist[0].id)
  }, [currentTrackId, playlist])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    let frame = 0
    const draw = (): void => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(0, 0, width, height)

      const analyser = analyserRef.current
      const bars = 48
      const data = new Uint8Array(analyser?.frequencyBinCount || bars)
      if (analyser) analyser.getByteFrequencyData(data)

      for (let i = 0; i < bars; i += 1) {
        const value = analyser ? data[i * 2] / 255 : (isPlaying ? (Math.sin(Date.now() / 160 + i) + 1) / 2 : 0.18)
        const barHeight = Math.max(4, value * height * 0.82)
        const x = (width / bars) * i
        ctx.fillStyle = `rgba(${255 - i * 2}, ${90 + i * 2}, 120, ${0.42 + value * 0.44})`
        ctx.fillRect(x + 2, height - barHeight, Math.max(2, width / bars - 4), barHeight)
      }

      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  const ensureAudioGraph = (): void => {
    if (!audioRef.current || sourceCreatedRef.current) return

    const context = new AudioContext()
    const analyser = context.createAnalyser()
    const source = context.createMediaElementSource(audioRef.current)
    analyser.fftSize = 128
    source.connect(analyser)
    analyser.connect(context.destination)
    audioContextRef.current = context
    analyserRef.current = analyser
    sourceCreatedRef.current = true
  }

  const addEntries = (entries: AudioFileEntry[]): void => {
    if (entries.length === 0) {
      setNotice({ text: '没有找到可整理的音乐文件。', kind: 'warning' })
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
    setNotice({ text: `已加入 ${entries.length} 个文件。`, kind: 'success' })
  }

  const startConversionForFiles = async (files: AudioFileEntry[]): Promise<void> => {
    if (files.length === 0) {
      setNotice({ text: '没有需要整理的文件。', kind: 'warning' })
      return
    }

    setIsConverting(true)
    setNotice({ text: `正在整理 ${files.length} 个文件...`, kind: 'info' })
    try {
      await window.api.startConversion({
        files,
        outputDirectory: outputDir,
        settings: {
          bitrateKbps: settings.bitrateKbps,
          skipExisting: settings.skipExisting
        }
      })
      setNotice({ text: '整理完成，新的 MP3 已加入播放列表。', kind: 'success' })
      if (settings.notifyOnDone) playDoneSound()
    } catch {
      setNotice({ text: '整理任务没有启动成功。', kind: 'error' })
    } finally {
      setIsConverting(false)
    }
  }

  const selectFiles = async (): Promise<void> => {
    const entries = await window.api.selectAudioFiles()
    addEntries(entries)
    if (settings.autoConvert) void startConversionForFiles(entries)
  }

  const selectFolder = async (): Promise<void> => {
    const entries = await window.api.selectImportFolder()
    addEntries(entries)
    if (settings.autoConvert) void startConversionForFiles(entries)
  }

  const oneClickWorkflow = async (): Promise<void> => {
    const entries = await window.api.selectImportFolder()
    addEntries(entries)
    await startConversionForFiles(entries)
  }

  const handleDrop = async (event: React.DragEvent<HTMLElement>): Promise<void> => {
    event.preventDefault()
    setDragActive(false)
    const filePaths = Array.from(event.dataTransfer.files)
      .map(file => (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path))

    const entries = await window.api.importDroppedFiles(filePaths)
    addEntries(entries)
    if (settings.autoConvert) void startConversionForFiles(entries)
  }

  const startConversion = async (onlyFailed = false): Promise<void> => {
    const candidatePaths = new Set(
      tasks
        .filter(task => onlyFailed ? task.status === 'failed' || task.status === 'unsupported' : task.status !== 'success')
        .map(task => task.filePath)
    )
    await startConversionForFiles(library.filter(file => candidatePaths.has(file.path)))
  }

  const chooseOutputDir = async (): Promise<void> => {
    const selected = await window.api.selectOutputDirectory()
    if (!selected) return
    setOutputDir(selected)
    setTasks(current => current.map(task => ({ ...task, outputDirectory: selected })))
    setNotice({ text: '保存位置已更新。', kind: 'success' })
  }

  const openOutputDir = async (): Promise<void> => {
    const result = await window.api.openOutputDirectory(outputDir)
    setNotice(result ? { text: result, kind: 'error' } : { text: '已打开保存位置。', kind: 'success' })
  }

  const savePlaylist = async (): Promise<void> => {
    await window.api.savePlaylist(playlist)
    setNotice({ text: '播放列表已保存。', kind: 'success' })
  }

  const loadPlaylist = async (): Promise<void> => {
    const document = await window.api.loadPlaylist()
    setPlaylist(document.tracks)
    setCurrentTrackId(document.tracks[0]?.id || null)
    setNotice({ text: `已读取 ${document.tracks.length} 首歌曲。`, kind: 'success' })
  }

  const playTrack = async (track: PlaylistTrack): Promise<void> => {
    setCurrentTrackId(track.id)
    setRecentPlayed(current => [track, ...current.filter(item => item.sourcePath !== track.sourcePath)].slice(0, 8))
    requestAnimationFrame(() => {
      ensureAudioGraph()
      audioContextRef.current?.resume()
      audioRef.current?.play()
        .then(() => setIsPlaying(true))
        .catch(() => setNotice({ text: '这首歌暂时无法播放，可以先整理成 MP3。', kind: 'warning' }))
    })
  }

  const togglePlayback = async (): Promise<void> => {
    if (!currentTrack || !audioRef.current) {
      setNotice({ text: '先选择一首歌。', kind: 'warning' })
      return
    }
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    await playTrack(currentTrack)
  }

  const selectRelativeTrack = (direction: -1 | 1): void => {
    if (playlist.length === 0) return
    const currentIndex = Math.max(0, playlist.findIndex(track => track.id === currentTrackId))
    const target = playMode === 'shuffle'
      ? Math.floor(Math.random() * playlist.length)
      : (currentIndex + direction + playlist.length) % playlist.length
    void playTrack(playlist[target])
  }

  const handleEnded = (): void => {
    if (playMode === 'repeat' && audioRef.current) {
      audioRef.current.currentTime = 0
      void audioRef.current.play()
      return
    }
    selectRelativeTrack(1)
  }

  const moveTrack = (draggedId: string, targetId: string): void => {
    setPlaylist(current => {
      const from = current.findIndex(track => track.id === draggedId)
      const to = current.findIndex(track => track.id === targetId)
      if (from < 0 || to < 0 || from === to) return current
      const next = [...current]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const removeTrack = (id: string): void => {
    setPlaylist(current => current.filter(track => track.id !== id))
    if (id === currentTrackId) setCurrentTrackId(null)
  }

  const clearCompleted = (): void => setTasks(current => current.filter(task => task.status !== 'success'))
  const clearPlaylist = (): void => {
    setPlaylist([])
    setCurrentTrackId(null)
    setIsPlaying(false)
  }
  const seek = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const next = Number(event.target.value)
    if (audioRef.current) audioRef.current.currentTime = next
    setCurrentTime(next)
  }
  const cyclePlayMode = (): void => {
    setPlayMode(current => current === 'order' ? 'repeat' : current === 'repeat' ? 'shuffle' : 'order')
  }

  return (
    <div className="app-shell">
      <audio
        ref={audioRef}
        src={currentTrack?.playableUrl || undefined}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={handleEnded}
      />

      {miniVisible && (
        <div className="mini-player">
          <button onClick={() => selectRelativeTrack(-1)}><SkipBack size={18} /></button>
          <button onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
          <button onClick={() => selectRelativeTrack(1)}><SkipForward size={18} /></button>
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ScanLine size={26} /></div>
          <div>
            <h1>Volcanic</h1>
            <span>music toolkit</span>
          </div>
        </div>

        <nav className="nav-stack">
          <button className="nav-active"><ListMusic size={16} />音乐库</button>
          <button onClick={oneClickWorkflow}><FolderOpen size={16} />整理</button>
          <button onClick={() => void startConversion(false)}><Disc3 size={16} />转换</button>
          <button onClick={() => setMiniVisible(current => !current)}><Music2 size={16} />小窗</button>
        </nav>

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
          <div className="drop-icon"><Upload size={28} /></div>
          <strong>拖入音乐</strong>
          <span>支持 MP3 / WAV / NCM / QMC / KGM</span>
        </section>

        <div className="button-stack">
          <button className="primary-button" onClick={oneClickWorkflow} disabled={isConverting}><FolderOpen size={17} />选择文件夹并整理</button>
          <button className="secondary-button" onClick={selectFiles}><FileAudio2 size={16} />导入文件</button>
          <button className="secondary-button" onClick={selectFolder}><FolderOpen size={16} />扫描文件夹</button>
          <button className="secondary-button" onClick={loadPlaylist}><ListMusic size={16} />读取列表</button>
          <button className="secondary-button" onClick={savePlaylist}><Save size={16} />保存列表</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="hero-panel">
          <div>
            <span className="eyebrow">local audio workflow</span>
            <h2>整理成可播放的 MP3</h2>
            <p>导入、转换、保存、播放，一条流程完成。</p>
          </div>
          <div className="hero-art">
            <div className="disc"><span>{isPlaying ? 'PLAYING' : 'READY'}</span></div>
          </div>
          <div className={`notice notice-${notice.kind}`}>{notice.text}</div>
        </header>

        <section className="metric-grid">
          <div><span>文件</span><strong>{library.length}</strong></div>
          <div><span>等待</span><strong>{waitingCount}</strong></div>
          <div><span>已完成</span><strong>{completedCount}</strong></div>
          <div><span>异常</span><strong>{failedCount}</strong></div>
          <div><span>进度</span><strong>{progressAverage}%</strong></div>
        </section>

        <section className="settings-panel">
          <div className="output-path">
            <span>输出</span>
            <strong title={outputDir}>{outputDir}</strong>
          </div>
          <div className="settings-actions">
            <button onClick={chooseOutputDir}><HardDrive size={15} />更改</button>
            <button onClick={openOutputDir}><FolderOpen size={15} />打开</button>
          </div>
          <div className="settings-controls">
            <label className="quality-field">
              <span>品质</span>
              <select value={settings.bitrateKbps} onChange={event => setSettings(current => ({ ...current, bitrateKbps: Number(event.target.value) as UserSettings['bitrateKbps'] }))}>
                <option value={128}>轻量</option>
                <option value={192}>均衡</option>
                <option value={320}>高质</option>
              </select>
            </label>
            <label className="check-field"><input type="checkbox" checked={settings.skipExisting} onChange={event => setSettings(current => ({ ...current, skipExisting: event.target.checked }))} /><span>跳过</span></label>
            <label className="check-field"><input type="checkbox" checked={settings.autoConvert} onChange={event => setSettings(current => ({ ...current, autoConvert: event.target.checked }))} /><span>自动</span></label>
            <label className="check-field"><input type="checkbox" checked={settings.notifyOnDone} onChange={event => setSettings(current => ({ ...current, notifyOnDone: event.target.checked }))} /><span>提示</span></label>
          </div>
        </section>

        <section className="queue-panel">
          <div className="section-header">
            <div>
              <span>整理队列</span>
              <h3>等待和结果</h3>
            </div>
            <div className="toolbar">
              <button onClick={() => void startConversion(false)} disabled={isConverting}>全部整理</button>
              <button onClick={() => void startConversion(true)} disabled={isConverting}>重试未完成</button>
              <button onClick={clearCompleted}>隐藏已完成</button>
            </div>
          </div>
          <div className="queue-list">
            {tasks.length === 0 && <div className="empty-state">选择一个文件夹，音乐会出现在这里。</div>}
            {tasks.map(task => (
              <article className="queue-row" key={task.id}>
                <div className="file-cell">
                  <strong>{task.fileName}</strong>
              <span>{task.sourceFormat.toUpperCase()} 转 MP3</span>
                </div>
                <div className="progress-cell">
                  <div className="progress-track"><div className={`progress-fill progress-${task.status}`} style={{ width: `${task.progress}%` }} /></div>
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
            <span>播放列表</span>
            <h3>正在收听</h3>
          </div>
          <button onClick={clearPlaylist}>清空</button>
        </div>
        <div className="playlist-list">
          {playlist.length === 0 && <div className="empty-state">整理完成的歌曲会自动加入播放列表。</div>}
          {playlist.map(track => (
            <article
              className={`track-row ${track.id === currentTrack?.id ? 'track-active' : ''}`}
              draggable
              key={track.id}
              onDragStart={() => setDragTrackId(track.id)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => {
                if (dragTrackId) moveTrack(dragTrackId, track.id)
                setDragTrackId(null)
              }}
              onDoubleClick={() => void playTrack(track)}
              onClick={() => setCurrentTrackId(track.id)}
            >
              <button className="track-play" onClick={() => void playTrack(track)}>
                {track.id === currentTrack?.id && isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <div className="track-copy"><strong>{track.title}</strong><span>{track.artist} · {track.duration}</span></div>
              <div className="track-actions"><button onClick={() => removeTrack(track.id)}><X size={14} /></button></div>
            </article>
          ))}
        </div>

        <div className="recent-panel">
          <h4>最近播放</h4>
          {recentPlayed.slice(0, 4).map(track => <button key={track.id} onClick={() => void playTrack(track)}>{track.title}</button>)}
          <h4>最近整理</h4>
          {recentConverted.slice(0, 4).map(task => <span key={task.id}>{task.fileName}</span>)}
        </div>
      </aside>

      <footer className="player-bar">
        <div className="now-playing">
          <div className="cover-art"><Music2 size={26} /></div>
          <div><strong>{currentTrack?.title || '还没有播放歌曲'}</strong><span>{currentTrack?.artist || '选择音乐开始播放'}</span></div>
        </div>
        <div className="transport">
          <canvas ref={canvasRef} className="visualizer" width="640" height="54" />
          <div className="transport-buttons">
            <button onClick={() => selectRelativeTrack(-1)}><SkipBack size={20} /></button>
            <button className="play-button" onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button>
            <button onClick={() => selectRelativeTrack(1)}><SkipForward size={20} /></button>
            <button className="mode-button" onClick={cyclePlayMode}>
              {playMode === 'order' ? <Repeat size={17} /> : playMode === 'repeat' ? <Repeat1 size={17} /> : <Shuffle size={17} />}
              {playMode === 'order' ? '顺序' : playMode === 'repeat' ? '单曲' : '随机'}
            </button>
          </div>
          <div className="scrubber">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min="0" max={duration || 0} value={Math.min(currentTime, duration || 0)} onChange={seek} />
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="volume-control">
          <span><Volume2 size={16} />音量</span>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={event => setVolume(Number(event.target.value))} />
        </div>
      </footer>
    </div>
  )
}

export default App
