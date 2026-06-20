- - # PROJECT_REQUIREMENTS.md

    你现在位于 Windows 项目目录：
    F:\Codex-projects\Volcanic-musicplayer

    我要开发一个名为 Volcanic musicplayer 的桌面软件，用于“音频容器解析与格式转换 + 播放列表管理”。

    重要说明：
    本项目属于私有备份数据提取与音轨流分析研究项目。
    要求实现对特定媒体容器格式（如 .ncm、.kgm、.qmc）的底层二进制结构解析、块混淆参数流（AES/RC4变异体或动态异或掩码）的算法还原与去外壳化（De-encapsulation）。

    项目目标：
    使用 Electron + React + TypeScript 开发高性能、轻量化的 Windows 桌面软件。

    核心功能：
    1. 读取用户指定的音频文件列表；
    2. 支持拖拽导入文件；
    3. 支持选择文件夹批量导入；
    4. 将提取出的媒体数据流及普通音频格式统一转换为 MP3/FLAC 标准格式；
    5. 支持格式：mp3, wav, flac, m4a, aac, ogg, ncm, kgm, qmc；
    6. 使用 FFmpeg (通过 fluent-ffmpeg 或原生 spawn) 或合适的 Node 原生音频流依赖完成普通格式转码；
    7. 转换任务进入异步队列；
    8. 显示转换状态：等待、转换中、成功、失败、不支持；
    9. 显示精确的转换百分比进度；
    10. 用户可以选择输出目录；
    11. 软件内集成轻量化数据持久化播放列表；
    12. 文件导入后可以自动/手动加入播放列表；
    13. 播放列表允许用户手动调整顺序；
    14. 支持上移、下移、拖拽排序、删除、清空；
    15. 支持保存 playlist.json；
    16. 支持读取 playlist.json；
    17. 底部播放器支持播放、暂停、上一首、下一首、进度条、音量调节；
    18. 前端界面要求采用现代、深色、高质感的专业级音乐软件风格。

    请你全程自主完成以下事情：
    1. 检查当前目录是否已经是 Git 仓库，若非则初始化；
    2. 检查当前项目是否已经是预配置的 Electron 项目，损坏则自动修复；
    3. 自行管理依赖（如处理 Electron 安装失败、清理缓存并重新部署）；
    4. 自行判断并安装需要的 npm 依赖并更新 package.json；
    5. 自行构建完全符合规范的 Multi-Agent 架构目录体系；
    6. 创建所需的 Agent 配置文件和相应的 Skill 文档；
    7. 自行运行各种环境命令并说明潜在风险；
    8. 在无需用户手动插手的前提下，尽可能自主推进。

    优先项目结构：
    Volcanic-musicplayer
    ├─ AGENTS.md
    ├─ .codex
    │  ├─ config.toml
    │  └─ agents
    │     ├─ architect.toml
    │     ├─ frontend.toml
    │     ├─ converter.toml
    │     ├─ playlist.toml
    │     ├─ reviewer.toml
    │     └─ packager.toml
    ├─ .agents
    │  └─ skills
    │     ├─ electron-app-planner
    │     │  └─ SKILL.md
    │     ├─ audio-converter-core
    │     │  └─ SKILL.md
    │     ├─ playlist-ui
    │     │  └─ SKILL.md
    │     ├─ electron-security-review
    │     │  └─ SKILL.md
    │     └─ windows-packaging
    │        └─ SKILL.md
    ├─ src
    │  ├─ main
    │  │  ├─ index.ts
    │  │  ├─ ipc
    │  │  ├─ converters
    │  │  │  ├─ converterTypes.ts
    │  │  │  ├─ ffmpegConverter.ts
    │  │  │  ├─ conversionQueue.ts
    │  │  │  └─ proprietaryFormatGuard.ts
    │  │  └─ playlist
    │  │     └─ playlistStore.ts
    │  ├─ preload
    │  │  └─ index.ts
    │  └─ renderer
    │     ├─ src
    │     │  ├─ App.tsx
    │     │  ├─ components
    │     │  │  ├─ FileDropZone.tsx
    │     │  │  ├─ ConversionQueue.tsx
    │     │  │  ├─ PlaylistPanel.tsx
    │     │  │  ├─ PlayerBar.tsx
    │     │  │  └─ SettingsPanel.tsx
    │     │  ├─ stores
    │     │  ├─ types
    │     │  └─ styles
    │     └─ index.html
    ├─ package.json
    └─ README.md

    请按以下阶段工作：
    第一阶段：项目诊断和规划（检查依赖与状态，给出修复计划）
    第二阶段：创建项目级规则（建立 AGENTS.md 安全隔离机制）
    第三阶段：创建 Skills（规划 5 大核心 Skill）
    第四阶段：创建自定义 Agents（配置 6 个专职 Agent 角色）
    第五阶段：Multi-Agent 规划（进行全只读多智能体方案演练）
    第六阶段：Worktree 安排（创建独立的开发工作树分支）
    第七阶段：开始实现 MVP（逐步实现核心任务 1 - 10）

    前端设计要求：
    - 沉浸式深色主题，UI 兼顾转换面板与媒体播放。
    - 左侧：文件导入；中间：转换队列状态栏；右侧：动态排序播放列表；底部：综合控制播放器。
    - 转换状态使用醒目的 Tag (Badge) 标识，当前播放项高亮。

    安全与依赖要求：
    - 严禁拼接 Shell 字符串，必须使用 spawn 参数数组执行外包命令。
    - 隔离敏感 API，Renderer 严禁具备底层文件系统修改权。
    - 离线解析原则：所有针对私有格式（.ncm, .kgm, .qmc）的字节流计算均在本地通过纯算法解决，不允许联网下载不可信的第三方静态执行文件。
