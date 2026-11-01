# 编译与包解析依据

工程使用 Vite 8.3.3 编译 main、preload、renderer 和 extension-host，运行结果见[工程验证](README.md)。程序输入和配置由调用方指定，完整输出由构建工作流交接。

## Node 与浏览器入口

main 与 extension-host 采用 Vite SSR 的 Node 解析语义，选择依赖的 Node 条件导出和入口字段。编译 target 确定输出语法，宿主配置确定模块解析与插件环境。Node 内建模块、Electron 和原生资源按部署合同外置，其余依赖按实际制品布局打包。[Vite SSR 配置](https://vite.dev/config/ssr-options)

[真实编译用例](../../../../clients/desktop/app/tests/tools/build/programs.test.ts)使用同时提供 browser／node 条件及 main／browser 字段的隔离依赖，核对实际模块和输出引用。preload 按各自配置独立生成 CommonJS，[入口变更用例](../../../../clients/desktop/app/tests/tools/build/preload.test.ts)验证后续编译读取当前配置。

## 开发快照

renderer 通过当前 Vite 环境的公开 this.resolve 解析依赖快照，package.json 与完整构建结果一起交接。成功采用后更新文档，既有快照内部的导入继续使用所属代际。

[快照用例](../../../../clients/desktop/app/tests/tools/dependency-snapshots.test.ts)核对开发条件、CSS 查询参数、第三方依赖解析、缺失入口失败与恢复采用。编译、解析和 HMR 由 Vite 提供，项目会话拥有资源准备、候选采用与进程寿命。[Vite 公共 API](https://vite.dev/guide/api-javascript.html)
