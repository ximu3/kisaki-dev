# 编译与包解析依据

工程使用 Vite 8.3.3 编译 main、preload、renderer 和 extension-host，运行结果见[工程验证](README.md)。程序输入和配置由调用方指定，完整输出由构建工作流交接。

## Node 与浏览器入口

main 与 extension-host 采用 Vite SSR 的 Node 解析语义，选择依赖的 Node 条件导出和入口字段。编译 target 确定输出语法，宿主配置确定模块解析与插件环境。Node 内建模块、Electron 和原生资源按部署合同外置，其余依赖按实际制品布局打包。[Vite SSR 配置](https://vite.dev/config/ssr-options)

[真实编译用例](../../../../clients/desktop/app/tests/tools/build/programs.test.ts)使用同时提供 browser／node 条件及 main／browser 字段的隔离依赖，核对实际模块和输出引用。preload 按各自配置独立生成 CommonJS，[入口变更用例](../../../../clients/desktop/app/tests/tools/build/preload.test.ts)验证后续编译读取当前配置。

有限编译在 Vite 的 [configResolved](https://vite.dev/guide/api-plugin.html#configresolved) 阶段检查最终 build.watch，启动编译前拒绝监听模式。监听与后续重建由开发会话拥有。2026-11-02 对 `ec15952` 的独立 Node 调用复核确认：无效模式立即拒绝，未创建输出，进程正常退出。

## 原生开发编译

renderer 使用 Vite 的 workspace ESM 解析和 HMR，公共依赖沿自己的构建 exports 消费。Node 程序使用 Vite 构建监听，完成事件交付实际输出文件；开发会话只在编译结果仍有效时启动对应程序。资源和包构建的准备步骤按实际输入触发，程序模块的依赖变化由编译器观察。

[程序解析用例](../../../../clients/desktop/app/tests/tools/build/programs.test.ts)核对 Node 条件与外部运行依赖；[准备输入用例](../../../../clients/desktop/app/tests/tools/inputs.test.ts)核对包、资源、原生及配置的归属。源码会话的实际行为由[开发回归](../../../../clients/desktop/app/tests/tools/dev/session.test.ts)核对。接口依据为 [Vite 公共 API](https://vite.dev/guide/api-javascript.html)与[构建监听](https://vite.dev/guide/build#rebuild-on-files-changes)。

Vite 8.3.3 客户端通过 blob SharedWorker 等待服务器重新就绪。工程载体仅在 development 模式允许对应 worker-src，生产 CSP 保持原值。
