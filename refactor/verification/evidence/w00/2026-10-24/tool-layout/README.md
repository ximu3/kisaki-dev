# 通用目录规范与桌面工具归属复核

通用目录规则补入根 [CONVENTIONS.md](../../../../../../CONVENTIONS.md) 与[工程约定](../../../../../../CONVENTIONS.md#directory-readability)，明确同级职责粒度、专用实现随拥有者、最小共享范围、入口与支撑角色，以及文件和目录的选择依据。具体名称和依赖约束继续由所在工程确定，保留 W00 已确认的工程边界。

桌面工具作为实际示例：开发、构建、资源、原生、打包目录与 clean.ts 表达完整任务；paths、targets、output、process、sha256 五个共用模块归 tools/lib；开发 Electron 定位归 tools/dev/electron-executable.ts。测试随新的拥有关系引用实现。目录树及职责见[桌面工具布局](../../../../../design/engineering/layout.md#desktop-tools)。

## 迁移核对

- 41 个相关工具与测试文件逐项比较：导入目标按移动关系保持一致；除导入位置和 paths.ts 的路径基准调整外，实现文本不变，见 [source-comparison.json](source-comparison.json)。
- 应用根、仓库根、有限构建输出和 Electron 可执行位置核对通过，见 [path-check.json](path-check.json)。
- 七个类型项目的源码覆盖仅对应文件移动，没有缩小，见 [typecheck-coverage.json](typecheck-coverage.json)。
- 运行源码仍通过既有依赖边界检查；tools/lib 不导入工程工作流或 CLI，应用运行代码不导入工具。

当前 Windows x64 有限构建身份为 `043d397e402a233876c8aa0569a4798deb6e38d92446b2355c7e36bd23295339`，已核对源码与运行构建一致，见 [identity-check.json](identity-check.json) 与 [desktop-build.json](desktop-build.json)。相关源码摘要见 [source-inputs.json](source-inputs.json)。

## 验证

环境为 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、Vite 8.3.3、Vitest 5.0.5、Playwright 1.64.1、Electron 44.5.1。以下命令从仓库根目录执行；测试使用独立目录与资料。

| 命令                                         | 结果与证据                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                 | 全仓类型、lint、依赖边界、格式与 25 项常规测试通过，包含输出失败保留和并发写入验证。[check.log](check.log)                          |
| `pnpm desktop:build --target windows-x64`    | 四个程序、资源及原生构建通过，实际使用迁移后的路径、目标、输出和进程支撑。[build.log](build.log)                                    |
| `pnpm --filter @kisaki3/desktop test:native` | 实际 Electron Node 宿主下原生／SQLite 8 项通过。[native.log](native.log)                                                            |
| `pnpm --filter @kisaki3/desktop test:e2e`    | 四类 Electron 窗口共 4 项通过，实际验证开发 Electron 定位和运行构建路径。[e2e.json](e2e.json)                                       |
| `pnpm --filter @kisaki3/desktop test:dev`    | 配置变化、库配置损坏及修复、源码失败保留、改名、HMR、公共包更新、进程交接与关闭通过。[development-test.json](development-test.json) |

公共包实现和配置未改动，八包制品消费证据沿用[公共包类型入口复核](../package-config/README.md)。性能、浏览器组件和最终桌面制品的既有结果保留在对应记录中，本轮不记为重新执行；其余五目标与远端 CI 仍待完成，W00 保持进行中。未提交、推送、发布或部署。
