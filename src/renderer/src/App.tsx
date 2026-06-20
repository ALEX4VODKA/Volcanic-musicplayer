// src/renderer/src/App.tsx
import React, { useState } from 'react'

type ConversionStatus = 'waiting' | 'converting' | 'success' | 'failed' | 'unsupported'

interface ConversionItem {
  id: string
  name: string
  sourceFormat: string
  targetFormat: string
  size: string
  status: ConversionStatus
  progress: number
}

interface PlaylistItem {
  id: string
  title: string
  artist: string
  duration: string
}

// --- MOCK 数据定义 ---
const MOCK_CONVERSION_QUEUE: ConversionItem[] = [
  { id: '1', name: '暗号_Unrecognized.qmc3', sourceFormat: 'qmc', targetFormat: 'FLAC', size: '32.4 MB', status: 'converting', progress: 45 },
  { id: '2', name: '夜曲_Encrypted.ncm', sourceFormat: 'ncm', targetFormat: 'MP3', size: '12.1 MB', status: 'waiting', progress: 0 },
  { id: '3', name: '岁月神偷_Locked.kgm', sourceFormat: 'kgm', targetFormat: 'FLAC', size: '28.7 MB', status: 'success', progress: 100 },
  { id: '4', name: '告白气球.wav', sourceFormat: 'wav', targetFormat: 'MP3', size: '44.2 MB', status: 'success', progress: 100 },
  { id: '5', name: '未知音频流_Corrupted.qmc0', sourceFormat: 'qmc', targetFormat: 'MP3', size: '8.5 MB', status: 'failed', progress: 12 },
  { id: '6', name: '纯音乐_Alpha.ncm', sourceFormat: 'ncm', targetFormat: 'FLAC', size: '35.1 MB', status: 'unsupported', progress: 0 }
]

const MOCK_PLAYLIST: PlaylistItem[] = [
  { id: 'p1', title: '🌋 Volcanic Echoes (Remix)', artist: 'Magma Studio', duration: '04:12' },
  { id: 'p2', title: '岁月神偷 (流还原备份)', artist: '金玟岐', duration: '04:22' },
  { id: 'p3', title: '告白气球 (标准重编码)', artist: '周杰伦', duration: '03:35' },
  { id: 'p4', title: 'Basalt Beats - Lo-Fi Loop', artist: 'Crater Dog', duration: '02:50' }
]

function App(): JSX.Element {
  // UI 交互状态管理
  const [currentPlayingId, setCurrentPlayingId] = useState('p1')
  const [isPlaying, setIsPlaying] = useState(false)
  const [outputDir, setOutputDir] = useState('D:\\Music\\Volcanic-Output')
  const [conversionQueue, setConversionQueue] = useState(MOCK_CONVERSION_QUEUE)
  const [playlist, setPlaylist] = useState(MOCK_PLAYLIST)
  const [notice, setNotice] = useState('等待导入音频资产')

  const getFileName = (filePath: string): string => filePath.split(/[\\/]/).pop() || filePath
  const getExtension = (fileName: string): string => {
    const dotIndex = fileName.lastIndexOf('.')
    return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : 'unknown'
  }
  const getTitle = (fileName: string): string => fileName.replace(/\.[^.]+$/, '')
  const isPrivateContainer = (extension: string): boolean => ['ncm', 'kgm', 'qmc'].includes(extension)

  const addFilesToWorkspace = (filePaths: string[]) => {
    if (filePaths.length === 0) {
      setNotice('没有选择新的音频文件')
      return
    }

    const timestamp = Date.now()
    const newQueueItems = filePaths.map((filePath, index): ConversionItem => {
      const fileName = getFileName(filePath)
      const extension = getExtension(fileName)

      return {
        id: `local-${timestamp}-${index}`,
        name: fileName,
        sourceFormat: extension,
        targetFormat: isPrivateContainer(extension) ? 'FLAC' : 'MP3',
        size: '待分析',
        status: 'waiting',
        progress: 0
      }
    })

    const newPlaylistItems = filePaths.map((filePath, index): PlaylistItem => {
      const fileName = getFileName(filePath)

      return {
        id: `track-${timestamp}-${index}`,
        title: getTitle(fileName),
        artist: '本地导入',
        duration: '待解析'
      }
    })

    setConversionQueue(current => [...newQueueItems, ...current])
    setPlaylist(current => [...current, ...newPlaylistItems])
    setCurrentPlayingId(newPlaylistItems[0]?.id || currentPlayingId)
    setNotice(`已导入 ${filePaths.length} 个音频资产`)
  }

  const handleSelectFiles = async () => {
    try {
      const filePaths = await window.api.selectAudioFiles()
      addFilesToWorkspace(filePaths)
    } catch {
      setNotice('文件选择失败，请重试')
    }
  }

  const handleSelectImportFolder = async () => {
    try {
      const filePaths = await window.api.selectImportFolder()
      addFilesToWorkspace(filePaths)
    } catch {
      setNotice('文件夹扫描失败，请检查访问权限')
    }
  }

  const handleSelectOutputDir = async () => {
    try {
      const selectedDir = await window.api.selectOutputDirectory()
      if (selectedDir) {
        setOutputDir(selectedDir)
        setNotice('输出目录已更新')
      }
    } catch {
      setNotice('输出目录选择失败，请重试')
    }
  }

  // 播放列表排序 Mock 动作
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newPlaylist = [...playlist]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex >= 0 && targetIndex < newPlaylist.length) {
      const temp = newPlaylist[index]
      newPlaylist[index] = newPlaylist[targetIndex]
      newPlaylist[targetIndex] = temp
      setPlaylist(newPlaylist)
    }
  }

  const removeItem = (id: string) => {
    setPlaylist(playlist.filter(item => item.id !== id))
  }

  // 状态标签渲染辅助器
  const renderStatusBadge = (status: ConversionStatus, progress: number) => {
    const styles: Record<string, { bg: string, color: string, text: string }> = {
      converting: { bg: 'rgba(255, 159, 67, 0.15)', color: '#ff9f43', text: `解析中 ${progress}%` },
      waiting: { bg: 'rgba(142, 142, 147, 0.15)', color: '#8e8e93', text: '等待中' },
      success: { bg: 'rgba(46, 213, 115, 0.15)', color: '#2ed573', text: '还原成功' },
      failed: { bg: 'rgba(255, 71, 87, 0.15)', color: '#ff4757', text: '解密失败' },
      unsupported: { bg: 'rgba(112, 111, 211, 0.15)', color: '#706fd3', text: '格式不支持' }
    }
    const config = styles[status] || styles.waiting
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 'bold',
        backgroundColor: config.bg,
        color: config.color,
        display: 'inline-block',
        whiteSpace: 'nowrap'
      }}>{config.text}</span>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0b0b0d',
      color: '#e1e1e6',
      fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      userSelect: 'none',
      overflow: 'hidden'
    }}>
      
      {/* 1. TOP HEADER 顶栏 */}
      <header style={{
        height: '60px',
        backgroundColor: '#121216',
        borderBottom: '1px solid #1f1f27',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🌋</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, letterSpacing: '1px', color: '#fff' }}>Volcanic musicplayer</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#666673' }}>高级容器流解包与多媒体资产控制台</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
          <div style={{ color: '#8e8e93' }}>
            输出目录: <span style={{ color: '#ff4757', fontFamily: 'monospace', backgroundColor: '#1c1c24', padding: '4px 8px', borderRadius: '4px' }}>{outputDir}</span>
          </div>
          <button style={{
            backgroundColor: '#ff4757',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }} onClick={handleSelectOutputDir}>更改</button>
        </div>
      </header>

      {/* 2. MAIN CONTAINER 主内容区 (三栏式布局) */}
      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* 左栏：文件导入区 */}
        <section style={{
          width: '260px',
          backgroundColor: '#121216',
          borderRight: '1px solid #1f1f27',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '1px' }}>数据输入源</h3>
          <div style={{ fontSize: '11px', color: '#706fd3', minHeight: '16px' }}>{notice}</div>
          
          {/* 拖拽盲区 Mock */}
          <div style={{
            flex: 1,
            border: '2px dashed #2d2d38',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#16161c',
            cursor: 'pointer',
            gap: '12px'
          }} onClick={handleSelectFiles}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="1.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
            <div>
              <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>拖拽音频文件至此</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#575766' }}>支持私有容器 (.qmc, .ncm, .kgm) 及标准无损格式</p>
            </div>
          </div>

          <button style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#1c1c24',
            border: '1px solid #2d2d38',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer'
          }} onClick={handleSelectImportFolder}>
            选择整个文件夹导入
          </button>
        </section>

        {/* 中栏：高级数据流转换队列 */}
        <section style={{
          flex: 1,
          backgroundColor: '#0b0b0d',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>流解包与重编码状态树</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ backgroundColor: '#2d2d38', border: 'none', color: '#e1e1e6', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>清空已完成</button>
              <button style={{ backgroundColor: '#ff4757', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>一键批量解包</button>
            </div>
          </div>

          {/* 任务列表表格 */}
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #1f1f27', borderRadius: '8px', backgroundColor: '#121216' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f27', color: '#8e8e93', backgroundColor: '#16161c' }}>
                  <th style={{ padding: '12px 16px' }}>源文件名</th>
                  <th style={{ padding: '12px 16px' }}>外壳特征</th>
                  <th style={{ padding: '12px 16px' }}>目标流</th>
                  <th style={{ padding: '12px 16px' }}>容量</th>
                  <th style={{ padding: '12px 16px' }}>状态机响应</th>
                </tr>
              </thead>
              <tbody>
                {conversionQueue.map((file) => (
                  <tr key={file.id} style={{ borderBottom: '1px solid #16161c', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px', color: '#fff', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', backgroundColor: '#1c1c24', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#a4b0be' }}>
                        {file.sourceFormat.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#ff6b81' }}>{file.targetFormat}</td>
                    <td style={{ padding: '12px 16px', color: '#a4b0be' }}>{file.size}</td>
                    <td style={{ padding: '12px 16px' }}>{renderStatusBadge(file.status, file.progress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 右栏：轻量化持久缓冲播放列表 */}
        <section style={{
          width: '320px',
          backgroundColor: '#121216',
          borderLeft: '1px solid #1f1f27',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>就绪储备播放列表</h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {playlist.map((track, index) => {
              const isCurrent = track.id === currentPlayingId
              return (
                <div key={track.id} 
                  onClick={() => setCurrentPlayingId(track.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: isCurrent ? 'rgba(255, 71, 87, 0.1)' : '#16161c',
                    border: isCurrent ? '1px solid rgba(255, 71, 87, 0.4)' : '1px solid #1f1f27',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: isCurrent ? 'bold' : 'normal', 
                      color: isCurrent ? '#ff4757' : '#fff',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {track.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666673', marginTop: '2px' }}>{track.artist}</div>
                  </div>

                  {/* 顺序微调控制器群 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <button 
                      disabled={index === 0}
                      onClick={() => moveItem(index, 'up')}
                      style={{ background: 'none', border: 'none', color: index === 0 ? '#333' : '#8e8e93', cursor: 'pointer', padding: '2px' }}
                      title="上移"
                    >
                      ▲
                    </button>
                    <button 
                      disabled={index === playlist.length - 1}
                      onClick={() => moveItem(index, 'down')}
                      style={{ background: 'none', border: 'none', color: index === playlist.length - 1 ? '#333' : '#8e8e93', cursor: 'pointer', padding: '2px' }}
                      title="下移"
                    >
                      ▼
                    </button>
                    <button 
                      onClick={() => removeItem(track.id)}
                      style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', marginLeft: '4px', fontSize: '12px' }}
                      title="移除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
            {playlist.length === 0 && (
              <div style={{ color: '#575766', fontSize: '12px', textAlign: 'center', marginTop: '4px' }}>播放队列太空了，快导入音频吧</div>
            )}
          </div>
        </section>
      </main>

      {/* 3. BOTTOM AUDIO PLAYER 控制条 */}
      <footer style={{
        height: '80px',
        backgroundColor: '#16161c',
        borderTop: '1px solid #1f1f27',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0
      }}>
        {/* 左侧：当前资产元数据 */}
        <div style={{ width: '240px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '6px',
            background: 'linear-gradient(45deg, #ff4757, #ff6b81)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 12px rgba(255, 71, 87, 0.2)'
          }}>
            🎵
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {playlist.find(t => t.id === currentPlayingId)?.title || "未选择播放项"}
            </div>
            <div style={{ fontSize: '11px', color: '#8e8e93', marginTop: '2px' }}>
              {playlist.find(t => t.id === currentPlayingId)?.artist || "无信号输入"}
            </div>
          </div>
        </div>

        {/* 中间：全局播放控制器 */}
        <div style={{ flex: 1, maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button style={{ background: 'none', border: 'none', color: '#a4b0be', fontSize: '16px', cursor: 'pointer' }} title="上一首">⏮</button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: 'none',
                color: '#000',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                paddingLeft: isPlaying ? '0px' : '3px'
              }}
              title={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button style={{ background: 'none', border: 'none', color: '#a4b0be', fontSize: '16px', cursor: 'pointer' }} title="下一首">⏭</button>
          </div>
          
          {/* 时间进度条 */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#666673' }}>
            <span>01:24</span>
            <div style={{ flex: 1, height: '4px', backgroundColor: '#2d2d38', borderRadius: '2px', position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: '35%', height: '100%', backgroundColor: '#ff4757', borderRadius: '2px' }} />
              <div style={{
                position: 'absolute',
                left: '35%',
                top: '-3px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                boxShadow: '0 0 4px rgba(0,0,0,0.5)'
              }} />
            </div>
            <span>{playlist.find(t => t.id === currentPlayingId)?.duration || "00:00"}</span>
          </div>
        </div>

        {/* 右侧：声学控制与其他 */}
        <div style={{ width: '240px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#8e8e93' }}>🔊</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            defaultValue="75"
            style={{
              accentColor: '#ff4757',
              width: '80px',
              height: '4px',
              cursor: 'pointer'
            }} 
          />
        </div>
      </footer>

    </div>
  )
}

export default App
