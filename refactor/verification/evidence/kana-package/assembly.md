# ZIP 执行范围与发行资产装配核对

2026-10-21，对应[整包接入设计](../../../design/projects/kana/distribution.md#backends)。本轮只补充 zip.js 全局配置、不同资产根和关闭隔离的一个场景，复用既有读取、流、格式及浏览器证据。

## 输入与执行

[prepare.py](prepare.py) 读取此前固定且已核对 npm integrity 的 zip.js 2.24.0 tarball，再核对 SHA-256。按其公开 @zip.js/zip.js/external 入口保留实际模块结构，连同 Wasm、许可和自有 worker、两份短 ZIP 夹具生成资产归档，解包到独立消费目录并逐文件核对摘要。第三方文件未改动，只位于忽略的缓存目录；工作区依赖和锁文件保持。

两个自有夹具都包含一个 chapter.txt，分别存放本试件生成的短文本、中文与 CRLF，以 deflate 压缩。它们没有用户文件或远端内容，不用于声称大型归档性能或完整压缩方法符合性。

[archive-worker.mjs](archive-worker.mjs) 将每份归档的 ZipReader、模块配置和解码状态放入独立 worker。两个 worker 导入同一个固定模块地址，但配置各自的 Wasm URL。useWebWorkers 为 false，因为整个归档已在 worker 内；本次另设 useCompressionStream 为 false，明确执行随包 Wasm 路径。

worker 通过范围请求取得字节，父侧仅转移自己新建的块。两个 worker 并发解码后，先关闭 A 的 ZipReader 和解码资源，再次读取 B，最后关闭 B。[probe.mjs](probe.mjs) 核对完整文本、成员身份、借入源缓冲和未结束的读取。

## 结果与范围

[run.cjs](run.cjs) 使用既有 Chromium 149.0.7827.55 测试构建，核对其可执行文件摘要，隐藏运行一次。完整结果及脚本摘要见 [browser-contract.json](browser-contract.json)，76 个装配文件及固定依赖来源见 [source-input.json](source-input.json)。

- 两个资产根均实际请求并加载自己的 zip-module.wasm。
- 两份归档均得到完整预期原文，关闭 A 后 B 仍可再次读取。
- 借入源缓冲保持，两个归档关闭时均没有未完成的范围读取。
- 受控页面只访问本次有限本地入口；没有外部请求或页面错误，浏览器和服务均已关闭。

本场景验证真实后端执行范围与资产复制装配，没有实现 Kana Reader，没有生成正式 @ximu3/kana，也没有重复运行三引擎矩阵。PDF 的显式 PDFWorker port 和 getDocument 参数另从已固定 PDF.js 6.4.299 的公开声明核对；本次未重跑 PDF 绘制。完整后端适配、取消与资源预算、Vite 运行包和 Electron 最终制品仍按正式实现验收。

复现使用现有依赖缓存与浏览器：

```powershell
python refactor/verification/evidence/kana-package/prepare.py
node refactor/verification/evidence/kana-package/run.cjs
```
