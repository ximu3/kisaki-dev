# 字体输入

Noto Sans SC Variable 5.3.1 与 Noto Sans Mono Variable 5.3.0 来自对应 Fontsource npm 包，使用 OFL-1.1。`inputs.json` 选择交付文件，资源工作流保留各包的 LICENSE、CSS 和 metadata。

字体按来源包的完整字节与名称装配，由桌面宿主提供给使用者。字体资源管理与阅读使用分别遵循[字体](../../../../../refactor/design/domains/appearance.md#fonts)和[阅读](../../../../../refactor/design/domains/reader.md)合同。

inputs.json 只列明所选包、字体文件和许可文件。版本与下载完整性由 pnpm 锁文件维护，准备后的资源字节由 resources.json 记录，不另行维护同一依赖的版本和输入摘要。
