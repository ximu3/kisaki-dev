# Vite 构建方式与社区方案比较

日期：2026-10-26。目标是让 Electron main、独立 extension-host、沙箱 preload 和 renderer 按各自宿主编译、解析和交接；比较现成能力后再决定项目需要维护的部分。本页保留方案比较阶段的结果，后续已按确认采用现有 Vite SSR 构建与原生解析，见[实施与验证](implementation/README.md)。

## 可选方案

| 方案                               | 能提供的能力                                                                              | 对 Kisaki 的取舍                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Vite 现有 SSR 构建与公开解析 API   | Node 环境的条件导出、入口字段、内建模块处理；renderer 继续使用 Vite 原有解析和 HMR        | 当前建议。可修正已确认的解析问题，沿用现有有限构建与会话交接，不引入新的构建插件。                                                     |
| Vite Environment API               | 通过 consumer: server 等显式环境描述多个目标，并由 createBuilder 组织构建                 | 语义上适合多个程序；但官方仍标为 RC，当前 createBuilder 声明为 experimental。基本解析试验通过，完整开发会话尚未验证。                  |
| electron-vite 6.0.0                | Electron 目标预设、main／preload／renderer 构建及常见热更新流程                           | 默认开发服务器会在主进程重建后直接结束并重启 Electron；与本项目可取消的正常退出、候选交接仍需适配。不能直接用默认流程替换现有合同。    |
| vite-plugin-electron 1.1.2         | 独立插件、公开构建 API、onstart 接管启动；multi-env 可配置自定义目标，包括 extension-host | 候选方案比旧三目标印象更完整。仍需处理应用就绪、成组输出采用与退出；multi-env 依赖上述 Environment API，本轮未安装插件或运行完整会话。 |
| 由 tsdown／Rolldown 编译 Node 程序 | 直接面向 Node 的编译与打包；tsdown 已用于公共包                                           | 技术上可选，但本轮未验证该替代。当前缺口可以由 Vite 的公开配置修复，尚无充分收益要求重新划分应用的编译工具职责。                       |

Vite 官方说明 [SSR 的 Node 解析与外部依赖语义](https://vite.dev/config/ssr-options)，以及 [Environment API 的阶段与多环境用途](https://vite.dev/guide/api-environment)。后者不是不可使用，但需要把其 API 稳定性与迁移验证成本纳入判断。

社区对同类问题已有直接依据：[vite-plugin-electron #98](https://github.com/electron-vite/vite-plugin-electron/pull/98)修复 Electron 构建错误采用 browser 入口的问题；[electron-vite 主进程预设](https://github.com/alex8088/electron-vite/blob/master/src/plugins/electron.ts)同时使用 Node 编译目标和 SSR 构建。另一项目的 [multi-env 文档](https://github.com/electron-vite/vite-plugin-electron#environment-api)及[实现](https://github.com/electron-vite/vite-plugin-electron/blob/main/src/multi-env.ts)支持自定义目标，不能再以“社区工具只能处理三个程序”排除它。

发行版本通过 npm 元数据核对，并读取其 gitHead 对应源码：[vite-plugin-electron 1.1.2 的 multi-env](https://github.com/electron-vite/vite-plugin-electron/blob/d8df14d5e46c0f72c165cfa1fd9d3643637023ff/src/multi-env.ts)确认 server 环境与自定义目标接入；[electron-vite 6.0.0 的开发服务器](https://github.com/alex8088/electron-vite/blob/23d7bfc8ba4a0f877ed4ef8ab193f2baedea50c2/src/server.ts)确认默认重建时直接结束并重启已有进程。

## 当前版本的实际比较

在 Vite 8.3.3 中，以隔离包提供 browser／node 条件导出和传统 main／browser 字段，调用公开 build／createBuilder 接口。所有构建使用 write: false；临时输入已清理。

| 配置方式                                                      | 条件导出 | 传统入口字段   | Vite 环境          |
| ------------------------------------------------------------- | -------- | -------------- | ------------------ |
| 现有 target: node24                                           | browser  | 原先未单独验证 | client             |
| 另加 rolldownOptions.platform: node                           | browser  | browser        | client             |
| platform: node，同时逐项改 conditions 和 mainFields           | node     | node           | 仍是 client        |
| build.ssr: true，ssr.target: node，ssr.noExternal: true       | node     | node           | ssr／server        |
| Environment API 的 consumer: server，resolve.noExternal: true | node     | node           | 自定义 server 环境 |

逐项覆盖解析选项虽然能解决样例里的入口选择，仍没有把整个 Vite 插件环境切换为服务端。因此更建议使用工具已有的宿主语义，而非继续维护一组局部补丁。

SSR 候选同时保留了 node:fs、普通 path 内建模块及显式外置依赖。还使用当前 main 与 extension-host 的真实源码做了内存构建：分别生成 entry.js，分析到 15 个与 1 个源码模块；主进程输出保留 Electron 与 Node 内建导入，extension-host 保留 node:worker_threads。结果见 [vite-options.json](vite-options.json)。这证明当前编译接入可行，不代替修改后的真实启动、开发恢复或打包验收。

建议的 Node 构建配置核心为：

```ts
export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    // Existing entry, output and explicit external dependency settings remain owned here.
  },
  ssr: {
    target: 'node',
    noExternal: true,
  },
})
```

这里采用 SSR 通道提供的 Node 构建语义。依赖是否打包仍须符合制品布局：当前应用排除 node_modules，不能直接采用社区工具“所有 dependencies 默认外置”的策略。Electron、Node 内建模块及实际原生资源的部署由各自合同处理；原生包的 JavaScript 包装层和 .node 文件也必须分别核对。[electron-vite 的依赖处理说明](https://electron-vite.org/guide/dependency-handling)体现了这些选项会影响交付，而非只是速度设置。

## 各部分仍由谁负责

- main、extension-host 采用 Node 构建语义；编译、条件解析和内建模块识别交给 Vite。
- preload 按沙箱合同生成独立 CommonJS 文件，不与完整 Node 宿主混同，也不能留下需要从文件系统加载的共享 chunk。能力核对采用 [Electron 44.5.1 的沙箱说明](https://github.com/electron/electron/blob/v44.5.1/docs/tutorial/sandbox.md)，不把最新文档中变化后的限制倒推到当前版本。
- renderer 使用 Vite 的解析与 HMR。公共包快照通过 this.resolve 选择入口，保留完整构建后采用、旧结果寿命和必要边界检查；此前三个包的九个导出已做解析对照。
- 项目协调代码只保留资源准备、依赖就绪、完整结果交接、隔离 profile 和正常退出等实际应用责任。

vite-plugin-electron 的 onstart 可以接管自动启动，因此不是无法适配。其[默认启动器](https://github.com/electron-vite/vite-plugin-electron/blob/main/src/startup.ts)与 electron-vite 的默认服务器都直接终止已有进程；采用这些工具时仍须接回本项目的退出确认和取消语义。不能只因配置更短，就把这部分工作误判为已经由工具覆盖。

## 依赖声明的判断

用户明确：工程需要的依赖应保留。用途包括已确认的构建与测试工具链、类型检查、配置加载、资产准备以及上游 peer 约束，不只包括产品源码中的直接 import。公共包暂时没有测试或某个工具暂时没有直接导入，只能提示核对用途，不能直接推出删除结论。没有在本次研究中删除或安装依赖。

最终确认采用 Vite SSR 构建加原生入口解析，已经完成[实施](implementation/README.md)。整体迁移到 Environment API 或社区插件仍是另一个方案，未在本次采用；方案比较阶段没有运行这两种插件的完整开发流程，也未执行新的六目标或制品测试。
