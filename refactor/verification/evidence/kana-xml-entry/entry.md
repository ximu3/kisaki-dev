# XML 编码入口与按需转换

2026-10-20，在用户分别确认 Expat 与 libiconv 后，本轮把[已验证的转换器](../kana-xml-codecs/codecs.md)接到实际文件编码识别入口。BOM、声明语法、编码别名、格式准入、原生／转换路径及失败收尾共同验证；不再由夹具直接告知入口“应该使用哪个编码”。

这是格式层输入机制证据，未覆盖正式 Reader、大书索引、完整编码符合性及发行包；完整验收见[阅读场景](../../scenarios/reading.md)。

## 输入路径

[input.mjs](input.mjs) 先读取有界前缀，按 XML 字节签名取得初始编码单元宽度与端序，从起始位置读取声明。声明语法交给同一 Expat 后端的短暂解析实例验证，取得 version、encoding 和 standalone 后释放；它不扫描或解释另一份 DTD，也不重写原文声明。

正常源处理使用独立的本次解析实例。UTF-8、UTF-16 及其明确端序形式、US-ASCII、ISO-8859-1 直接喂给 Expat；扩展编码才加载固定 libiconv，把有界输出逐段送给明确配置为 UTF-8 的 Expat。识别时已读取的源前缀完整接回后续读取，不丢失或重复正文。

原始签名和声明先核对，不能靠“强制 UTF-8 接口能解析”跳过来源一致性。无声明、无 BOM 时使用 UTF-8；通用 UTF-16 缺少 BOM 时失败；UTF-16BE／LE 按明确端序解释。UTF-32 等其他编码仍需声明。来源字节、解码字节和 XML 展开结果分别受预算约束。

依据为 [XML 1.0 的编码规则](https://www.w3.org/TR/xml/#charencoding)及[自动识别附录](https://www.w3.org/TR/xml/#sec-guessing)。本入口处理文件字节，没有外部 MIME charset 覆盖参数；不同编码都能合法解释的字节不做意图猜测。它不执行 EPUB／FB2 的完整格式校验，仅核对这里所属的编码准入。

## 固定编码名集合

[registry.mjs](registry.mjs) 从实际编译的 libiconv 枚举名称及别名，生成小型静态登记数据。XML 入口读取这份数据即可选择路径，不需要先加载转换 Wasm 来识别 UTF-8。

生成时排除：

- 不符合 XML EncName 的名称，例如包含冒号的别名。
- CHAR、WCHAR_T、内部／交换端序表示等依赖宿主语义的名字。
- C99、JAVA 这类编程语言转义表示。
- 不能按本入口的 XML 自识别方式承载声明的裸字符集。这里实际用其解码器核对声明所需的 ASCII 字节，而非根据名称猜测。

当前保留 **97 个规范解码名称、292 个有效名字**，排除记录和生成摘要见 [registry-contract.json](registry-contract.json)。Unicode 宽编码单独按已识别的宽度和端序处理。匹配只做 XML 所需的 ASCII 大小写折叠，不去掉标点、不修整声明内空格、不映射宿主 locale，也不接受 IGNORE／TRANSLIT 开关。

97 是本次固定构建可接入的名称集合，不是本轮逐字符验证了 97 个编码的声明。真实字符转换继续由固定上游与 CP932 校正承担；[前序编码对照](../kana-xml-codecs/codecs.md)覆盖 26 种编码，以及 CP932 表的全部 7,915 个已定义映射。升级时须审阅登记数据和语义差异。

## 覆盖与结果

[prepare.py](prepare.py) 复用前序 27 组独立预期 XML，并增加 BOM、声明、别名、错误、格式限制与预算输入，共 **84 组**。常规输入按 1、3、4096 字节分块，长状态编码输入按 7、4096 字节分块，每个完整运行得到 **251 次**组合。

| 环境                           | 实际路径                 | 结果                         |
| ------------------------------ | ------------------------ | ---------------------------- |
| Node 24.11.1                   | 本地 Wasm 与完整字节入口 | 251 次组合及八项收尾检查通过 |
| Chromium 149.0.7827.55         | 真实模块 worker          | 同上                         |
| Firefox 153.0                  | 真实模块 worker          | 同上                         |
| Windows Playwright WebKit 26.5 | 真实模块 worker          | 同上                         |

覆盖包括 UTF-8 默认值和 BOM、UTF-16 两端序与缺失 BOM、UTF-32 两端序、大小写／合法空白、ASCII／Latin-1／Windows 别名、CP932 校正、没有声明的处理指令、错置或重复声明、未知编码、非法编码名、XML 1.1、截断字符、解码后 XML 语法错误、不支持的字节序和 EBCDIC 签名，以及标准本地实体目录和不可取得的外部实体。

合法 XML 中的未知编码名 `constructor` 也明确失败，不能命中登记对象的原型属性。EPUB 入口拒绝超出其 Unicode 编码范围的输入，即使 libiconv 可以解码；失败不触发另一种编码重试。

每个环境另运行八项生命周期检查：

1. 已取消操作不接触源迭代器。
2. 在声明前缀期间取消。
3. 在扩展编码正文已开始处理后取消。
4. 源读取失败。
5. 上游明确报告 sourceChanged 时保留该类别。
6. 转换资产不可用。
7. 源读取收尾自身失败，不交付成功结果。
8. 来源变化与读取收尾同时失败时，保留 sourceChanged 分类及两个原因，不能被普通释放错误掩盖。

取消用例的源释放故意异步延迟 20 ms，操作确实等待其结束。所有失败没有交付部分源树，XML 解析实例与转换句柄最终为零；失败后立即解析正常文档仍成功。这些是本次输入处理持有的读取，不会释放宿主借入的整个授权范围。

## 实际按需加载

每个浏览器先在一个独立 worker 中运行 16 组原生编码输入，共 48 次分块组合。该阶段没有请求 `codec.mjs` 或 `codec.wasm`，也没有创建转换模块。

随后在新的 worker 中运行全部 84 组及八项收尾检查，转换脚本和 Wasm 实际按需请求，转换模块创建一次并供该试件的顺序任务使用。worker 中没有 DOMParser 和 Document。登记数据的静态读取不等于提前加载 libiconv。

[browser-contract.json](browser-contract.json) 保存两个阶段、实际转换资产请求、脚本／数据／Wasm 摘要及精确浏览器输入。页面错误和外部请求为零；每个 worker 在交付结果后终止，浏览器上下文、进程与本机服务均已关闭。它不是 Safari、WebKitGTK 实机或全部 Electron 接入验收。

## 构建与复现

[build.py](build.py) 复用此前固定且核对过的 Expat 2.9.0、libiconv 1.19、六项 CP932 校正及 Emscripten 6.0.12。原来的源码、试件和运行记录均未改写；本轮 C 接入只增加声明读取、明确编码配置和构建期名称枚举。

[build-contract.json](build-contract.json)、[source-input.json](source-input.json) 和 [node-contract.json](node-contract.json) 分别保存构建、输入与运行摘要。额外导出的名称枚举和活动实例计数用于本试件，不是新的公开 Reader API。

```powershell
python -B refactor/verification/evidence/kana-xml-entry/build.py
node refactor/verification/evidence/kana-xml-entry/registry.mjs
python -B refactor/verification/evidence/kana-xml-entry/prepare.py
node refactor/verification/evidence/kana-xml-entry/run-node.mjs
node refactor/verification/evidence/kana-xml-entry/run-browser.cjs
```

前缀预算、解码输出量、节点量及原生堆参数属于隔离试件；正式容量按格式拥有者验证，不直接成为用户设置或整进程内存承诺。没有新增生产目录、工作区依赖或锁文件变更。
