# 打包输入

应用身份、平台载体与安全 fuses 由相邻的 `electron-builder.yml` 维护。图标来自 `assets/icons/source.png`，由资源工作流生成，不在此保存另一份源稿。

`tools/package/packager.ts` 从完整构建准备独立打包目录，以 `publish: never` 调用 electron-builder。每个载体的 `distribution.json` 进入 ASAR。Windows ZIP 与 NSIS 分别生成；macOS 的 DMG 和更新 ZIP 使用同一份 `.app`。最终文件的身份与 SHA-256 写入目标输出中的 `artifacts.json`。

macOS 的普通打包强制要求签署身份。没有凭据时可显式使用 `--test-only` 生成标明用途的测试制品；此标记不能用于正式发行。平台证书、更新与最终六目标验收继续按 [W11](../../../../refactor/implementation/work-packages.md#w11) 执行。
