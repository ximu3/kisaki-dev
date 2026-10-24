# Kana 阅读路线的来源与浏览器试验

对应已确认的[阅读路线](../../../design/projects/kana/formats.md)。本轮没有创建 Kana 独立仓库，没有执行完整 Kana 实现，也没有改变已确认的持久源地址。

## 公开输入与源码核对

[prepare-reading-probe.py](prepare-reading-probe.py) 下载固定来源、核对 npm 制品完整性并保存[来源结果](reading-source-contract.json)。第三方源码和解包资产位于忽略的 node_modules/.cache/kana-design；没有修改工作区依赖或锁文件，也没有执行 npm 安装脚本。

| 来源                                                                                                                                                   | 核对结果                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [PDF.js 6.4.299](https://registry.npmjs.org/pdfjs-dist/6.4.299)                                                                                        | Apache-2.0；本轮实际使用该 tarball 的脚本、worker、字体及资源入口                                                              |
| [zip.js 2.24.0](https://registry.npmjs.org/@zip.js/zip.js/2.24.0)                                                                                      | BSD-3-Clause；本轮使用其公开 Reader／ZipReader，未使用内部源码入口                                                             |
| [Foliate MOBI 模块](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/mobi.js)                                  | MIT；包含 PalmDOC／HUFF-CDIC、尾部数据、KF8 skeleton／fragment 及固定布局处理；其高层打开与 DOM 转换不直接等同本项目源地址合同 |
| [libarchive RAR4](https://github.com/libarchive/libarchive/blob/v3.8.10/libarchive/archive_read_support_format_rar.c)                                  | 当前固定源码仍包含 solid 归档不支持的失败路径；不能据项目总表中的 RAR 名称推定完整支持                                         |
| [libarchive.js reader](https://github.com/nika-begiashvili/libarchivejs/blob/0989c1a6db20d030d793b1763e20d880068091bd/src/webworker/archive-reader.js) | 使用 file.arrayBuffer，再复制到 Wasm；C 包装调用 archive_read_open_memory，不满足当前有界输入要求                              |
| [官方 UnRAR 7.23 源码](https://www.rarlab.com/rar/unrarsrc-7.2.7.tar.gz)                                                                               | version.hpp 为 7.23、非 beta；许可为 UnRAR；读／seek 边界和 DLL 顺序解码可审阅，但本轮未构建 Wasm                              |
| [Emscripten Asyncify](https://emscripten.org/docs/porting/asyncify.html)                                                                               | 可让同步 C／C++ 接续异步 JavaScript；存在代码体积与重入约束，不能以此代替实际输入桥接与取消验证                                |
| [parse5 解析选项](https://parse5.js.org/interfaces/parse5.ParserOptions.html)                                                                          | 可提供源位置及 HTML 树修复；隐式生成元素可能没有源位置，不自动提供原始字节映射                                                 |
| [css-tree](https://github.com/csstree/csstree)                                                                                                         | 提供 CSS 语法树；无法解释的内容可能保留为 Raw，授权过滤必须显式处理这一分支                                                    |

该轮核对时，官方 UnRAR 源码入口指向的 unrarsrc-7.3.1.tar.gz 内部版本为 7.30 beta 1；本次另行核对并选用 7.23 稳定源码用于源码比较，未按归档名猜测产品版本。该轮未固定完整 Wasm 工具链；后续固定输入和实际解码结果见 [Wasm 浏览器验证](../kana-rar/rar-wasm.md)。

## 实际浏览器执行

运行方式：

```powershell
python refactor/verification/evidence/kana/prepare-reading-probe.py
python refactor/verification/evidence/kana/run-reading-probe.py
```

第二步复用此前已经取得并记录的 Electron 44.5.1 Windows x64 运行时；需要[其输入记录](../libmpv-gpu/binary-input.json)中的本地路径存在。运行窗口隐藏，启用 sandbox、contextIsolation，关闭 nodeIntegration，不向页面提供 Node preload 桥接。试验临时使用仅绑定回环地址的文件服务器，退出时关闭；它不是 Kisaki 的资源方案，也没有把生产资源接入改成本机 HTTP。

实际代码为 [reading-electron.cjs](reading-electron.cjs)、[reading-probe.mjs](reading-probe.mjs) 和 [reading-probe.html](reading-probe.html)，结果保存于 [reading-browser-contract.json](reading-browser-contract.json)。生成的 PDF／ZIP 为本项目自有合成夹具，不是用户书籍。两者各加入约 8 MiB 的未引用内容，以区分局部读取与全量加载；这不能代表真实大型文档的复杂度或峰值内存。

| 实际检查         | 本轮结果                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| 隔离文档         | allow-same-origin、不授予 allow-scripts；脚本和事件属性未运行，书内样式未影响宿主，授权 Blob 图像正常加载            |
| 外部资源         | 书内外部图片、CSS import 和字体没有到达网络请求边界；试验另设拒绝外部请求的兜底，但出现请求即判失败                  |
| 原生跨文档 Range | 设置到第二个文档后塌缩，证明单个 Range 不能承担跨章选择                                                              |
| 鼠标跨文档选择   | 用浏览器真实输入注入完成拖动，起始文档成功捕获指针，8 次移动跨入第二个 iframe，得到完整逻辑端点                      |
| 重排高亮         | 改变第一章字号和宽度、第二章改为 vertical-rl；源端点和合成原文未变，两个局部高亮的实际几何变化                       |
| ZIP              | 8,388,859 字节输入，读取 65,733 字节、4 次范围请求，成功解压指定 deflate 成员并关闭                                  |
| PDF              | 8,389,332 字节输入，读取 66,260 字节、2 次范围请求；实际 worker 解码、绘制非空像素、提取文字，完成 viewport 正反转换 |
| PDF 几何及关闭   | 夹具含 CropBox、UserUnit=2、Rotate=90；destroy 触发输入 transport 的 abort                                           |

源代码、依赖 tarball 与夹具的 SHA-256 随结果保存。npm tarball 同时与固定版本元数据中的 SHA-512 integrity 比对。浏览器试验使用来自公开发行包的文件，但尚未经过 @ximu3/kana 的正式打包流程。

## 证据范围

跨章试验只有两个简单源文字片段和直接映射，不是完整 EPUB 解析器或 CFI 实现；其中出现的 chapter／offset 是试验内部标识，不是新增公开持久地址。试验没有执行关闭重开、键盘扩展、自动滚动、系统剪贴板、ruby、双向文字或整个文档虚拟化。

恶意节点特意保留在 srcdoc 中，用来验证 sandbox／CSP 的第二道边界；这不代表正式方案可以省略源结构过滤。没有完成完整 HTML／SVG／CSS 过滤器的验证。

PDF 的绘制和提取实际运行，但未验证完整文字层选择、异常 PDF、运行中取消或峰值内存。ZIP 测试关闭了 zip.js 自己的 worker，不能据此声称它的 worker／Wasm 制品装配已经通过。PDF 页的 viewport 正反变换也不等于整个 Kana 页面区域、裁边、缩放和 Annotation 往返已通过。

该轮没有执行 MOBI／KF8 解码或 RAR Wasm；源码中的功能分支不构成格式兼容证据。受支持格式的完整接入按[阅读验收](../../scenarios/reading.md)核对。
