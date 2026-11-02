# 开发监听与隔离副本

工程使用 Vite 8.3.3、Chokidar 6.0.0 和 Turbo 2.11.10。开发会话合同见[工作区](../../../design/engineering/workspace.md#desktop-development)，运行结果见[工程验证](README.md)。

## 监听与就绪

Vite 管理 renderer HMR，Chokidar 管理完整运行时和依赖输入。会话一次登记输入并等待 ready，再开始首次编译；监听的寿命覆盖 Vite 服务重启。初始化失败释放已建立资源，运行错误交给会话处理。

[输入监听用例](../../../../clients/desktop/app/tests/tools/inputs.test.ts)在真实 Vite 重启后修改源码、配置和依赖输入，验证变更仍被观察，并核对文档、测试与生成文件的排除范围。[Vite 服务器 API](https://vite.dev/guide/api-javascript.html#vitedevserver)和 [Chokidar 6 源码](https://github.com/paulmillr/chokidar/blob/6.0.0/src/index.ts)提供对应接口依据。

## 隔离副本

开发回归在独立 workspace 中安装固定依赖并建立有效 Git HEAD，使 Turbo 按源码和配置形成稳定输入身份。安装优先复用已准备的包存储，由 pnpm 补齐合成依赖解析所需的元数据。副本拥有自己的源码、合成依赖、资料目录及构建输出，测试结束后统一释放。

[开发回归](../../../../clients/desktop/app/tests/tools/dev/session.test.ts)在同一个隔离副本中覆盖正常退出取消、编译失败后的可用实例、源码改名恢复、依赖恢复和 HMR，以及启动准备取消后的进程关闭与完整重试。每项用例拥有自己的进程并恢复修改的输入。Electron 分发文件通过已安装包的公开入口取得，复制时保留平台链接结构。
