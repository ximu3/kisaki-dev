# Kisaki

Kisaki 面向游戏、动画、漫画与小说的本地资料管理和使用。本仓库维护[完整产品规格](refactor/README.md)、工程工具、原生文件能力及其验证。产品实现与发行进度见[实施状态](refactor/implementation/status.md)。

安装 `.node-version` 与根 `packageManager` 指定的 Node、pnpm，以及 Rustup 和当前平台的 C/C++ 构建工具后，运行：

```sh
pnpm install --frozen-lockfile
pnpm check
```

桌面工程测试使用独立载体和合成资料。构建、Electron、开发监听和制品验证入口见 [CONTRIBUTING](CONTRIBUTING.md)，实际源码边界见 [ARCHITECTURE](ARCHITECTURE.md)，编码要求见 [CONVENTIONS](CONVENTIONS.md)。

本项目由个人维护，接受受邀协作者的 PR。问题与建议通过 [Issues](https://github.com/ximu3/kisaki/issues) 或 [Telegram](https://t.me/kisaki3) 反馈。

本仓库工程代码采用 AGPL-3.0-only，第三方资源保留各自许可。产品与公共包的交付许可见[项目身份与许可](refactor/design/engineering/repository.md)。
