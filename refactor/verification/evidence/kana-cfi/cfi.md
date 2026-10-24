# CFI 完整语法、源上下文与原生 Range 绑定

2026-10-20。本轮补证 [CFI 的既有责任](../../../design/projects/kana/formats.md#cfi)，没有改动正式 Reader、公共位置类型或项目依赖。早期 32 项试件与 Foliate 对照保留原样，本目录是独立的扩展机制验证。

## 结论

CFI 的语法值、源位置和展示能力可以分开处理，并保持同一地址语义。原始 XML 的真实路径、ID、文字槽、spine 出现身份及嵌套引用链负责寻址；显示节点通过绑定回到这些事实。包装、拆分 Text 或更换显示文档都不重新编号源 CFI。

图片 alt 与媒体终点能作为源地址解析、比较及生成，不等于已经提供相应的文本选区或播放能力。试件明确拒绝这些未实现的展示投影，保留时间 `0` 和完整空间值，没有截短地址后跳到元素。

## 依据与输入

规则对照 [EPUB CFI 1.1](https://w3c.github.io/epub-specs/epub33/epubcfi/)。固定源身份下仍采用 Kana 已确认的严格断言政策，不执行规范所建议的跨修订目标纠偏；UTF-16 端点另遵守 Kana 不切开代理对的合同，不能把这项应用限制说成 CFI 语法要求。

[cases.mjs](cases.mjs) 包含六份自有最小 XML 文档和三类资源事实。package 的 spine 位于 `/8`，同一 XHTML 重复出现，另含独立阅读路径；内容覆盖 CDATA、实体、注释、处理指令、xml:id、DTD 声明的 ID、逻辑空文字槽、图片 alt、iframe／object／embed 和 SVG 引用。这些文档用于源图机制验证，不是完整 EPUB 包或 EPUB 符合性样本。

XML 继续使用已确认的 Expat。桥接只增加读取 `XML_GetIdAttributeIndex`，让格式层取得解析器实际识别的 ID 属性；不另写 XML 解析器。所有输入均为 UTF-8，完整编码入口已有[独立验证](../kana-xml-entry/entry.md)。构建输入、包含文件、参数及输出校验见 [build-contract.json](build-contract.json)。

## 实测

| 层次               | 每个适用运行时的结果                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 语法、序列化与比较 | 66 项检查，包括完整转义、扩展参数、严格数值语法、超安全整数和精细小数、范围与 side bias                             |
| 源解析和生成       | 23 项检查，包括真实 spine 路径、所有已知 ID、重复出现、嵌套引用、严格断言、alt、媒体、阅读路径及 URL 单次解码       |
| 重开恢复           | 112 个合法源文字端点；按 1、3、4096 字节重新解析，共恢复 336 次                                                     |
| 原生显示绑定       | Text 按 1、3、11 个 UTF-16 单元拆分并加入包装；每引擎恢复 336 个端点，核对 258 个原生 Range 和 77 个 side bias 边界 |
| 失败与隔离         | ID／原文不符、缺失或歧义引用、越界、非法 indirection、错用嵌入上下文和无源装饰均明确拒绝                            |

Node 24.11.1 执行前三层。Chromium 149.0.7827.55、Firefox 153.0、Windows Playwright WebKit 26.5 执行全部层次。各运行时的源解析检查结束时，活动 Expat parser 均为零。精确输入校验与结果分别见 [node-contract.json](node-contract.json) 和 [browser-contract.json](browser-contract.json)。

数字在语法层以原十进制串保留，比较不先转换为浮点数；只有访问已知源节点或文字时才按实际边界转为整数。比较忽略断言和 side bias，保留隐式文字偏移 `0`、时间／空间顺序、完整范围终点及 `y` 优先的含义。

文字断言从原始 XML 文字索引读取，跨元素折叠空白，空槽也有精确的源边界。失败不会搜索相近文本。生成地址时重新补齐引用链及各路径中的已知 ID，不继承外来 CFI 所省略的断言。普通超链接不能充当 CFI indirection。

显示试件保留 Text 到源文字区间的反向绑定，包含 UTF-16 拆分恰好落在代理对中间的情形：内部节点可以这样拆分，交付的合法源端点仍不能切开字符。side bias 选择边界两侧的显示片段，但不改变源比较结果。两个嵌入引用即使进入同一资源、同一根片段，也不能互换显示上下文。

## 文件与复现

- [grammar.mjs](grammar.mjs)：语法值、转义、精确比较和范围展开。
- [source.mjs](source.mjs)、[source.c](source.c)：Expat 事件到本试件的格式源事实。
- [book.mjs](book.mjs)：package、文字索引、严格解析、生成及上下文。
- [projection.mjs](projection.mjs)、[browser.mjs](browser.mjs)：原生节点绑定和浏览器检查。
- [run-browser.cjs](run-browser.cjs)：与固定 KF8 共用的有限 loopback 路由；没有任意文件转发或外部请求。

在仓库根目录执行；先准备既有 XML 构建及标准目录输入，固定 KF8 输入按其[复现步骤](../kana-kf8-fixed/fixed.md)准备：

```text
python refactor/verification/evidence/kana-cfi/build.py
node refactor/verification/evidence/kana-cfi/run-node.mjs
node refactor/verification/evidence/kana-kf8-fixed/run-node.mjs
pnpm exec prettier --write refactor/verification/evidence/kana-cfi/node-contract.json refactor/verification/evidence/kana-kf8-fixed/node-contract.json
node refactor/verification/evidence/kana-cfi/run-browser.cjs
```

浏览器基线见 [source-input.json](../kana-browser-scope/source-input.json)。传入单个引擎名称只运行诊断，不覆盖三引擎正式记录。浏览器、页面与服务均在 finally 中关闭。

## 证据边界

本轮证明完整语法各类别与关键源语义、上下文及 DOM 绑定的可行路线，不声称完成全部 CFI／EPUB 符合性或真实出版物回归。资源事实由有限输入提供，URI 授权和资源转发继续归既有拥有者；没有增加另一套资源后端。

显示检查使用独立文档中的真实 DOM Range，没有执行完整 Reader、实际嵌入媒体播放、跨章节拖选或浏览器版式验收。试件只有小型源树与索引，不覆盖大书内存预算或按需加载；完整接入按[阅读验收](../../scenarios/reading.md)核对。
