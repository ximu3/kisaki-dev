# 编译与包解析依据

工程使用 Vite 8.3.3 编译 main、preload、renderer 和 extension-host，运行结果见[工程验证](README.md)。程序输入和配置由调用方指定，完整输出由构建工作流交接。

## Node 与浏览器入口

main 与 extension-host 采用 Vite SSR 的 Node 解析语义，选择依赖的 Node 条件导出和入口字段。编译 target 确定输出语法，宿主配置确定模块解析与插件环境。Node 内建模块、Electron 和原生资源按部署合同外置，其余依赖按实际制品布局打包。[Vite SSR 配置](https://vite.dev/config/ssr-options)

[真实编译用例](../../../../clients/desktop/app/tests/tools/build/programs.test.ts)使用同时提供 browser／node 条件及 main／browser 字段的隔离依赖，核对实际模块和输出引用。preload 按各自配置独立生成 CommonJS，[入口变更用例](../../../../clients/desktop/app/tests/tools/build/preload.test.ts)验证后续编译读取当前配置。

有限编译在 Vite 的 [configResolved](https://vite.dev/guide/api-plugin.html#configresolved) 阶段检查最终 build.watch，启动编译前拒绝监听模式。监听与后续重建由开发会话拥有；同组用例确认无效模式不会创建编译输出或遗留 watcher。

## 开发快照

renderer 通过当前 Vite 环境的公开 this.resolve 解析当前依赖副本，package.json 与完整构建结果一起交接。准备失败保留当前副本，成功采用后重启 Vite、刷新文档并释放旧副本；不继续保留旧文档的历史代际。重启同时释放 Vite 的旧模块图和监听资源。

[副本用例](../../../../clients/desktop/app/tests/tools/dependency-snapshots.test.ts)核对开发条件、CSS 查询参数、第三方依赖解析、Node 专用条件导出、准备失败与旧副本释放。浏览器解析只针对真实浏览器消费，不能预先拒绝包内合法的 Node 入口。编译、解析和 HMR 由 Vite 提供，项目会话拥有资源准备、候选采用与进程寿命。[Vite 公共 API](https://vite.dev/guide/api-javascript.html)

已核对 Vite 8.3.3 客户端的重连实现：它使用 blob SharedWorker 等待服务器重新就绪。工程载体仅在 development 模式允许对应 worker-src，生产 CSP 保持原值；实际依赖更新的浏览器回归验证重连与新值采用。
