# Volcanic Musicplayer EXE

Volcanic Musicplayer EXE 是基于 Electron + React + TypeScript 的 Windows 桌面端音乐整理、私有媒体容器解包与播放列表管理工具。它面向本地音乐文件整理场景，提供文件夹扫描、格式识别、离线解包、输出目录管理和基础播放体验。

当前打包配置中的 Windows 产物名称为 `Volcanic mvp v1.1`。

## 核心能力

- 扫描本地文件夹中的音频文件。
- 支持 MP3、WAV、FLAC、M4A、AAC、OGG 等常见音频格式。
- 支持 `.ncm`、`.kgm`、`.qmc` 私有媒体容器的本地解包。
- 解包后自动识别 MP3、FLAC、WAV 音频负载。
- 可选择输出目录，并从界面直接打开保存位置。
- 支持播放列表读取、保存、清空和最近播放记录。
- 支持播放、暂停、上一首、下一首、顺序/随机模式等基础控制。
- UI 使用深色高对比风格，偏工具型音乐播放器体验。

## 输出规则

- MP3 文件会直接复制到输出目录并加入播放列表。
- WAV 文件可通过内置 JS 编码流程整理为 MP3。
- 其他需要完整转码的格式会调用本机 FFmpeg。
- `.ncm`、`.kgm`、`.qmc` 会先在本地离线解包，再根据识别到的负载类型输出。
- 无法识别的私有容器负载会显示失败原因，不做伪转换。

默认输出目录为：

```text
D:\Music\Volcanic-Output
```

用户可在界面中更改该目录。

## 架构边界

- Renderer 进程只负责声明式 UI。
- Main 进程负责文件系统访问、私有容器解析、FFmpeg 子进程和系统弹窗。
- Preload 只暴露白名单 IPC API。
- Renderer 进程不直接引入或暴露 `fs`、`child_process`、`cluster`。
- FFmpeg 调用使用 `spawn` 参数数组，避免 shell 字符串拼接。

## 开发

安装依赖：

```powershell
cd F:\Codex-projects\Volcanic-musicplayer
npm.cmd install
```

启动开发环境：

```powershell
npm.cmd run dev
```

静态检查：

```powershell
npm.cmd run typecheck
```

构建前端和主进程产物：

```powershell
npm.cmd run build
```

打包 Windows EXE：

```powershell
npm.cmd run pack
```

构建输出目录由 `package.json` 中的 Electron Builder 配置决定，当前为：

```text
release
```

## FFmpeg

MP3、WAV 和可识别的私有容器负载可在轻量路径中处理。M4A、AAC、OGG、FLAC 等需要转码时，建议安装 FFmpeg，或通过 `FFMPEG_PATH` 指定可执行文件路径。

## 说明

本项目仅用于本地个人媒体资产整理、兼容性测试和离线格式恢复。请只处理你拥有合法访问权的音频文件。
