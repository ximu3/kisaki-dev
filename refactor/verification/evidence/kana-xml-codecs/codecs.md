# XML 扩展编码对照验证

2026-10-20，本轮为[XML 扩展编码方案](../../../design/projects/kana/formats.md#xml-codecs)比较原生 TextDecoder、GNU libiconv 1.19 和一份明确校正 CP932 映射的私有构建。Expat 2.9.0 继续负责 XML 语法。用户随后确认采用 libiconv、六项校正及对应发行材料；本页保留候选比较时的证据，生产 manifest 和锁文件仍随正式实施交付。

后续[编码入口验证](../kana-xml-entry/entry.md)已补上 BOM、声明、别名、格式编码限制、实际 worker 接续和按需加载。下文未覆盖项描述本轮原始试件的边界，不将其结果扩大为后来新增检查。

## 为什么不能直接共用 TXT 解码

[XML 1.0 §4.3.3](https://www.w3.org/TR/xml/#charencoding)建议按注册编码的含义解释名称，不能处理时明确失败；它不要求支持所有注册编码。[WHATWG Encoding](https://encoding.spec.whatwg.org/#names-and-labels)拥有自己的网页标签集合和映射规则。两套名称恰好相同，不意味着其含义全部相同。

以下为本次三个浏览器引擎的实际对照，完整数据见 [browser-contract.json](browser-contract.json)：

| 声明／输入              | 固定编码候选           | 浏览器 TextDecoder             |
| ----------------------- | ---------------------- | ------------------------------ |
| ISO-8859-1，`80`        | U+0080                 | 归入 windows-1252，得到 U+20AC |
| ISO-8859-9，`80`        | U+0080                 | 归入 windows-1254，得到 U+20AC |
| Shift_JIS，`81 60`      | U+301C                 | U+FF5E                         |
| CP932，`81 60`          | 校正后为 U+FF5E        | 不接受这个标签                 |
| GB2312，`81 40`         | 不属于该编码，明确失败 | 归入 GBK，得到 U+4E02          |
| Big5，`88 62`           | 不属于该编码，明确失败 | 得到 U+00CA、U+0304            |
| UTF-32LE，`00 F6 01 00` | U+1F600                | 不支持                         |

Node 24.11.1 的两个观察又不同：ISO-8859-1 的该字节输出 U+0080，Big5 的该序列输出 U+F325。它们单独保存在 [node-contract.json](node-contract.json)，没有替代浏览器观察，也没有据此修改 TXT 已确认的 WHATWG 语义。

Expat 的 [UnknownEncodingHandler](https://libexpat.github.io/doc/api/latest/#XML_SetUnknownEncodingHandler)另有约束：自定义转换中的标量不超过 U+FFFF，而且不能把不同字节序列映射为同一字符。它不能直接成为覆盖补充平面字符和全部状态编码的通用入口；UTF-8／UTF-16 的内建支持不受这个限制。

## 真实构建与候选差异

[build.py](build.py) 从 GNU 官方 1.19 源归档构建 WebAssembly，并保留原始候选与校正候选。归档 SHA-256、编译参数、Emscripten 6.0.12 输入、C 桥接和制品摘要见 [build-contract.json](build-contract.json)。既有 Expat 试件和第三方原始源码不变；私有副本的唯一解码数据改动见 [cp932.patch](cp932.patch)。

原始 libiconv 在 CP932 的六个字节位置采用 JIS 文字对应，源码也明确说明这是它自己的选择。直接采用它会把 `81 60` 解释为 U+301C，而[微软公开 CP932 表](https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP932.TXT)给出 U+FF5E。

本轮先对原始候选检查表中全部 7,915 个已定义映射，得到恰好六处差异；再在私有副本按该表校正这六处，重新检查得到零差异。没有进行 Unicode 归一化，也没有在整个 XML 文本上统一替换相似字符。该检查不声称穷尽所有编码的有效、未定义、私用区和历史版本。

| 项目                         | 当前试件                                |
| ---------------------------- | --------------------------------------- |
| 校正候选 Wasm                | 913,809 字节                            |
| 仅该 Wasm 的 gzip            | 655,536 字节                            |
| 候选 Wasm 初始内存及本轮观察 | 2 MiB                                   |
| 测试输入分块                 | 1、2、7、4096 字节；长输入用 7、4096    |
| 输出块容量                   | 16、257 字节                            |
| 实际最大待转码输入           | 4098 字节，包含不完整字符尾部           |
| 源归档许可                   | LGPL-2.1-or-later；许可原文随源归档保存 |

体积与内存都是此构建的观察，不是正式包大小或整个 Reader 的内存上限。Expat 的独立试件内存、JavaScript 源树及浏览器资源不包含在这 2 MiB 中。

## 覆盖与结果

[prepare.py](prepare.py) 用 Python 明确编码生成 26 种编码的 27 组自有 XML：UTF-8、UTF-16LE／BE、UTF-32LE／BE，ISO-8859 的 1／2／5／7／9／15，Windows-1251／1252，KOI8-R／U，Shift_JIS、CP932、EUC-JP、ISO-2022-JP，GB2312、GBK、GB18030，Big5、Big5-HKSCS，EUC-KR、CP949。额外一组是较长的 ISO-2022-JP 状态切换输入。

预期树由相应原文经 lxml 6.1.0／libxml2 2.11.9 独立建立，并保留 namespace、属性规范化、CRLF、实体、CDATA、注释与处理指令的源含义。libxml2 直接读取原始编码字节时匹配其中 26 组；CP932 同样有上述字符差异，所以它没有被作为该编码唯一的正确性依据。来源和预期摘要见 [source-input.json](source-input.json)。

校正候选在 Node 24.11.1，以及 Chromium 149.0.7827.55、Firefox 153.0、Windows Playwright WebKit 26.5 中，每个环境完成 212 次分块／输出容量组合，全部得到预期 XML 树。每个环境还验证：

- 损坏 UTF-8、未完成 UTF-16、非法 UTF-32 标量、GB18030 截断、Shift_JIS 非法序列、状态转义截断和越出 GB2312 的输入明确失败。
- 未知或空编码、试图加入 IGNORE／TRANSLIT 的名称拒绝。
- 解码输出预算和取消生效；失败及完成后原生转换句柄均为零。
- CP932 的 7,915 个已定义映射与固定表一致。

合计每个环境 13 个失败／取消场景。[convert.mjs](convert.mjs) 保留不完整字符尾部，增量交付 UTF-8；[cases.mjs](cases.mjs) 将输出直接送入 Expat，没有先拼成整份 UTF-8 文档。Expat 在本试件明确配置为接收 UTF-8；原始 XML 声明没有被正则改写。

三个浏览器的页面错误和外部请求均为零，全部运行时、上下文和本机服务均已关闭。此处没有验证真实 Safari、WebKitGTK 或完整 Electron 集成。

## 尚未证明的部分

本轮由夹具显式提供预先已知的编码。完整 BOM／声明识别、声明冲突、UTF-16 无 BOM 的准入、别名集合、各格式自己的编码限制和按需加载尚未实现，不能仅将原文件传给强制 UTF-8 的 Expat 接口就宣称完成这些检查。

全部合法编码字节、完整有界源树／索引、worker 中途终止、发行替换与重建、许可材料和正式包消费仍需交付。既有 XML 语法、实体目录及预算试件继续提供其原有证据，本轮没有重复跑完整候选比较。

```powershell
python -B refactor/verification/evidence/kana-xml-codecs/prepare.py
python -B refactor/verification/evidence/kana-xml-codecs/build.py
node refactor/verification/evidence/kana-xml-codecs/run-node.mjs
node refactor/verification/evidence/kana-source-mapping/run-browser.cjs
```

所有第三方源、二进制和生成的大夹具保存在忽略的试验缓存中；可审阅的构建、转换、测试程序与摘要保存在本目录。
