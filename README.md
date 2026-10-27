# Kisaki

Kisaki 面向游戏、动画、漫画与小说的本地资料管理和使用。当前仓库按 [refactor](refactor/README.md) 重建，现有交付是 W00 的工程基础；业务能力按后续工作包逐项实现，尚未提供新版正式发行。

桌面工程位于 `clients/desktop/app`，八个公共包和 33 个官方扩展项目分别位于相邻的 `packages` 与 `extensions/projects`。根 `packages` 中的三个私有工程包提供共享 TypeScript、ESLint 配置和工具函数。完整进度与实测范围见 [实施状态](refactor/implementation/status.md)。

安装 Node 24.11.1、pnpm 11.11.0、Rustup 与当前平台的 C/C++ 构建工具后，运行：

```sh
pnpm install --frozen-lockfile
pnpm desktop:dev
```

构建所需的资源和平台工具见 [开发指南](CONTRIBUTING.md)。开发资料位于应用的 `.local/development`，普通重启与 `clean` 会保留它。

本项目由个人维护，接受受邀协作者的 PR。问题与建议通过 [Issues](https://github.com/ximu3/kisaki/issues) 或 [Telegram](https://t.me/kisaki3) 反馈。

开发与验证见 [CONTRIBUTING](CONTRIBUTING.md)，源码边界见 [ARCHITECTURE](ARCHITECTURE.md)，编码要求见 [CONVENTIONS](CONVENTIONS.md)。桌面与官方扩展采用 AGPL-3.0-only，八个公共包采用 MIT；第三方材料保留各自许可。
