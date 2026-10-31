# 开发监听与隔离副本

核对基于 Vite 8.3.3、Chokidar 6.0.0、Turbo 2.11.10 和 2026-10-27 的实际试件。现行行为由[桌面开发合同](../../../design/engineering/workspace.md#desktop-development)定义，正式六目标运行见[W00 验收](README.md)。

## 输入监听

Linux 试件中，公共包配置在 Vite watcher 扫描完成前被修改，后续扫描没有补发该次变更。Vite 的公开 `watcher.add()` 不提供追加路径完成扫描的等待结果，首次 `ready` 也不能代表之后添加的路径就绪。

| 方案 | 适用性与代价 |
| --- | --- |
| 复用 Vite watcher | 依赖较少，但公开接口缺少追加输入的就绪边界，且服务重启需要重新注册。 |
| 独立 Chokidar 6 | 一次传入完整运行时及公共包输入，等待 `ready`；会话拥有监听寿命，增加直接开发依赖。 |
| @parcel/watcher 2.6 | 提供异步订阅与取消，但引入原生二进制及目录监听适配；未完成本项目接入验证。 |
| Node fs.watch | 无额外库，需要自行处理各平台事件、重建与恢复。 |

采用独立 Chokidar 后，Linux 原型五次回归通过，正式实现再通过六目标开发场景。Vite 负责 renderer HMR，开发会话负责运行时及公共包输入；初始化和运行失败沿会话寿命处理。

依据：[Vite 公共服务器 API](https://vite.dev/guide/api-javascript.html#vitedevserver)、[Chokidar 6.0.0 实现](https://github.com/paulmillr/chokidar/blob/6.0.0/src/index.ts)、[Parcel watcher API](https://github.com/parcel-bundler/watcher#watching)及 [Node fs.watch 平台说明](https://nodejs.org/docs/latest-v24.x/api/fs.html#fswatchfilename-options-listener)。

## 隔离开发副本

Turbo 2.11.10 在没有有效 Git HEAD 的副本中把生成的 `.turbo/turbo-build.log` 纳入输入，使连续构建改变任务 hash。试件建立独立 Git 上下文与空提交后，源码仍按内容参与哈希，生成日志不再改变输入。

| Windows x64 副本 | 第一次构建 | 第二次构建 | 第二次命中 |
| --- | ---: | ---: | ---: |
| 复制目录 | 5.429 秒 | 5.135 秒 | 0 / 4 |
| 仅 git init | 5.092 秒 | 5.101 秒 | 0 / 4 |
| git init 与有效 HEAD | 5.511 秒 | 0.762 秒 | 4 / 4 |

这是单次顺序测量，用来解释输入与命中变化，不是全 CI 的稳定提速比例。试件的提交身份和 hook 设置只作用于其独立仓库。Electron 分发文件通过公开包入口准备后再复制，避免把首次下载时机当成固定前提。
