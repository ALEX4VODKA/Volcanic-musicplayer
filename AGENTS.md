# AGENTS.md

## 项目目标
本项目名为 Volcanic-musicplayer，是一个基于 Electron + React + TypeScript 构建的高性能媒体资产管理与流还原桌面应用。

## 核心规则
1. 在推进开发前，必须严格对齐 PROJECT_REQUIREMENTS.md 的所有指标。
2. 架构边界隔离（Architectural Isolation）：
   - Renderer 进程充当纯粹的声明式 UI 视图层。
   - Main 进程独占底层文件系统访问权、FFmpeg 子进程控制树、本地私有流处理器及系统级原生弹窗。
   - Preload 脚本仅通过 contextBridge 注入白名单内的最小化 IPC 通道。
3. 严禁在 Renderer 进程中显式引入或暴露 Node.js 的 `fs`、`child_process` 或 `cluster` 模块。
4. 执行多媒体流转换时，FFmpeg 的调用必须严格限制于 `spawn` 数组参数传递形式，防御命令注入漏洞。
5. **容器层深度解析规范**：项目必须原生实现针对特定历史遗留私有媒体格式（.ncm、.kgm、.qmc）的二进制文件解包逻辑。
   - `.ncm`: 提取文件特征头部后，利用置换密码箱（Modified S-Box）对后续的数据流进行逐块（Chunk-by-chunk）异或转换。
   - `.qmc`: 针对其静态掩码表（Static Obfuscation Table）及衍生出的动态种子流进行位异或（Bitwise XOR）矩阵还原。
   - `.kgm`: 校验魔数头部，结合其多轮嵌套异或键值流，对原始音频负荷（Payload）进行解算。
6. 每次执行逻辑重构或状态流变动后，必须在根目录触发 `npm run typecheck` 或 `npm run build` 进行全量静态类型合规性审查。
7. 遵循最小修改原则（Principle of Least Variance），严禁改动与当前分配任务无关的模块。