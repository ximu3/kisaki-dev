# 格式组的一次衔接核对

2026-10-20。本轮把原文／搜索接续、格式进度、索引与驻留、图片页表一起写入现有设计。按照本轮协作要求，复用此前已经通过的机制证据，只新增一次小型组合检查，没有重跑 XML、CFI、KF8 和浏览器测试矩阵。

## 本次实际运行

[prepare.py](prepare.py) 用 Python 标准库生成一个自有 ZIP 和对应目录：两个有效 PNG，其中一个使用 .dat 后缀；一个名为 .png 的普通文本；一个说明文件。PNG 和 ZIP 的字节均由试件生成，没有读取用户书籍。

[run.mjs](run.mjs) 执行两个衔接：

- 既有 parse5 来源映射接入既有 Case Folding／NFC 机制。`Stra<span>ße</span>` 匹配 `STRASSE`，`Cafe<i>&#x301;</i>` 匹配 `CAFÉ`；保存字节端点后用另一分块重新解析，读回的原文分别是 `Straße` 和保留组合形式的 `Café`。
- 固定 zip.js 实际读取四个成员并校验载荷，与目录字节逐项相同；按内容识别 PNG，再使用既有自然排序。两种输入均得到 `pages/2.dat`、`pages/10.png`，后缀没有覆盖实际类型。ZIP 句柄随后关闭。

结果和直接输入校验见 [integration-contract.json](integration-contract.json)。这是组合检查，不是新的文字解析器、完整图片识别器或大书性能测试；未运行 CSS 可读资格、图像像素解码及完整 Reader。

```text
python -B refactor/verification/evidence/kana-format-integration/prepare.py
node refactor/verification/evidence/kana-format-integration/run.mjs
```

## 本轮复用的依据

| 设计判断                                         | 直接依据                                                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 不以展示节点或搜索字符串重新建立源地址           | [HTML 来源映射](../kana-source-mapping/mapping.md)、[CFI 与显示绑定](../kana-cfi/cfi.md)、[TXT／FB2 往返](../kana-source/source-addresses.md)                                                  |
| 完整原文与搜索共用映射，浏览器字符串不成为源权威 | [原文与视图试验](../kana-content/content-and-view.md)，加本次两个组合例子                                                                                                                      |
| 解码状态不能当作任意字节重启点                   | [已验证 XML 输入](../kana-xml-entry/entry.md)；[Encoding 解码状态](https://encoding.spec.whatwg.org/#decoders)与 [Expat 暂停／恢复](https://libexpat.github.io/doc/api/latest/#XML_StopParser) |
| 索引和显示分开驻留，暂存写入形成背压             | [资源执行与寿命](../kana-resource-runtime/runtime.md)、[章节上下文反例](../kana-layout-boundaries/boundaries.md)                                                                               |
| 原始页身份不随显示或枚举顺序改变                 | [固定 KF8 页面](../kana-kf8-fixed/fixed.md)、[图片自然排序](../kana-formats/format-inputs.md)，加本次实际 ZIP／目录比较                                                                        |
| ZIP 使用现有公开读取能力和固定名称解释           | 固定 zip.js 2.24.0 的 `GetEntriesOptions`、`rawFilename`、Unicode Path 和成员输出源码；来源基线见[阅读路线记录](../kana/reading-route.md)                                                      |

原文接续见[带来源的文字流](../../../design/projects/kana/content.md#text-flow)，索引、进度与页表见[格式设计](../../../design/projects/kana/formats.md#indexes)。本页组合试件未执行完整格式适配、复杂出版物或容量测量。
