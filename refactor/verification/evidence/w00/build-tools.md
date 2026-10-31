# Node 构建与依赖解析

2026-10-26，基于 Vite 8.3.3 比较 Electron main、独立 extension-host、沙箱 preload 与 renderer 的构建接入。采用 Vite SSR 的 Node 语义及原生入口解析，正式工程结果见[W00 验收](README.md)。

| 方案 | 能力与取舍 |
| --- | --- |
| Vite SSR 与公开解析 API | 提供 Node 条件导出、入口字段和内建模块语义，renderer 沿用原生 HMR；满足当前构建与交接需要。 |
| Vite Environment API | 可以表达多个宿主；核对版本中仍为 RC，createBuilder 声明为 experimental。基本解析试验通过，未验证完整开发流程。 |
| electron-vite 6.0.0 | 提供 Electron 目标预设；默认重建直接结束并重启进程，仍需接回可取消的正常退出。 |
| vite-plugin-electron 1.1.2 | onstart 可接管启动，multi-env 支持自定义目标；成组采用、就绪与退出仍由应用协调，未验证完整接入。 |
| tsdown／Rolldown | 具备 Node 编译能力，tsdown 已用于公共包；本次没有验证它替代应用构建的收益。 |

比较依据：[Vite SSR](https://vite.dev/config/ssr-options)、[Environment API](https://vite.dev/guide/api-environment)、[社区 Node 入口修正](https://github.com/electron-vite/vite-plugin-electron/pull/98)、[electron-vite 6.0.0 开发服务器](https://github.com/alex8088/electron-vite/blob/23d7bfc8ba4a0f877ed4ef8ab193f2baedea50c2/src/server.ts)及 [vite-plugin-electron 1.1.2 多环境实现](https://github.com/electron-vite/vite-plugin-electron/blob/d8df14d5e46c0f72c165cfa1fd9d3643637023ff/src/multi-env.ts)。这些是核对日期与版本的结果，不代表未测方案已经可交付。

## 解析试件

隔离包同时提供 browser／node 条件及传统 main／browser 字段，使用公开 build／createBuilder 接口和 `write: false`：

| 配置 | 条件导出 | 传统入口 | Vite 环境 |
| --- | --- | --- | --- |
| 仅 target: node24 | browser | 未单独验证 | client |
| 再设 rolldownOptions.platform: node | browser | browser | client |
| 再指定 conditions 与 mainFields | node | node | client |
| build.ssr 与 ssr.target: node | node | node | ssr／server |
| Environment API consumer: server | node | node | 自定义 server |

SSR 试件保留 Node 内建模块与显式外置依赖；真实 main 和 extension-host 源码的内存构建也通过。应用自身的制品布局决定哪些依赖外置，不能直接套用社区工具的默认 node_modules 布局。

## 开发快照

renderer 通过当前 Vite 环境的公开 `this.resolve` 解析包快照，完整 package.json 与 dist 一起交接。真实服务器用例验证了开发条件、CSS 查询参数、坏入口拒绝、修复采用以及旧代际内部导入。编译、解析与 HMR 由 Vite 负责，项目协调器拥有资源准备、候选采用与正常退出；运行时输入的监听依据见[开发监听](development.md)。
