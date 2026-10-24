# Kana 格式源解释的联合验证

2026-10-19，使用隔离试件核对 XML 解释完整性、RAR 原始名称、CFI 源图及 MOBI／KF8 字节到 HTML 节点的映射。以下记录实验输入与结果。

浏览器使用隐藏的 Electron 44.5.1／Chromium 152.0.7977.130、独立 Worker、关闭 Node 接入。四组验证均通过各自断言，外部请求为零；结果见 [browser-contract.json](browser-contract.json)。Node 24.11.1 的独立运行与更多端点检查见 [node-contract.json](node-contract.json)。两轮执行同一机制，不能被当成两个独立格式实现的交叉验证。

后续 [Foliate 对照审视](../kana-foliate-review/reassessment.md)补充了正常 XHTML 标准实体用例，当时的 Expat 试件未通过，而浏览器路径可以正常解释；同轮还运行了未修改的 Foliate CFI 测试与实际格式入口。再后的[格式与输入验证](format-inputs.md)在独立试件中补齐标准实体目录，比较三种 JavaScript 解析器与浏览器，并实测 URL 与图片排序机制。本页旧结果保持原样，不能扩展为 XML 引擎已经确认或全部格式兼容性通过。

当前 XML 选型及编码入口的采用与验证见[设计说明](../../../design/projects/kana/formats.md#xml-codecs)。随后又补充 [CFI 完整语法与显示绑定](../kana-cfi/cfi.md)、[固定 KF8 二进制页面](../kana-kf8-fixed/fixed.md)，各自保留独立的输入和运行记录。

| 范围      | 实际覆盖                                                                                           | 结论边界                                                                   |
| --------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| XML       | 3 份既有 FB2，四种分块，共 12 次独立预期树比较；25 项正常／失败用例分别用两种分块执行              | 支持采用可控 XML 事件入口；不是完整 XML 合规性或全部编码证明               |
| RAR 名称  | 14 份派生 RAR5、4 份上游 Unicode／加密头归档，另加旧编码和损坏 Unicode 名各一份派生归档            | 证明原始名称钩子与准入机制，未穷尽归档特性与引用图组合                     |
| EPUB CFI  | 一个真实 ZIP 容器内的 6 份 XML 资源，32 项源图与语法用例                                           | 支持关键结构的解释路线；不是完整 CFI 符合性声明                            |
| MOBI／KF8 | 6 份上游文件、10 个内容分支、10 份重建 KF8 文档；另有受控 HTML 修复样本                            | 覆盖原始流、重建与文字映射；样本没有固定 KF8                               |
| 字节端点  | 16 份标记流；Node 检查 431,680 个端点，浏览器检查全部 215,840 个源单元起点，并更换解析输入分块恢复 | 范围是实际映射的文字及零宽单元，未证明任意标记、所有修复或所有阅读正文转换 |

## 固定输入与来源

[source-input.json](source-input.json) 保存下载内容、版本与 SHA-256：Expat 2.9.0 提交 `e127b43ac1f514e0b320508893aa338ecd5e72be`；libmobi 样本及独立预期固定于 `906274205c11944b628da1c553b255acb1af7c55`；另保存 EPUB、CFI、XML API 与 RAR 格式资料。

MOBI 底层算法试验继续使用此前核对的 Foliate 提交 `78914aef4466eb960965702401634c2cb348e9b1`。私有副本只增加显式打开原始分支的入口并导出原有索引函数，不经过自动优选 KF8、资源替换或阅读器初始化。原文件与适配后摘要及 MIT 许可见 [mobi-adapter-input.json](mobi-adapter-input.json)。libmobi 在本轮只提供样本与预期摘要，没有被作为运行依赖采用，也没有执行它的完整测试脚本或 DRM 工具。

HTML 试验固定 parse5 8.0.1 与 entities 8.0.0，按 registry integrity 核对归档；浏览器束由现有 esbuild 0.28.1 生成，见 [html-input.json](html-input.json)。额外编码数据来自 Unicode 的 12 份 OEM 映射及 WHATWG Windows-1252 索引，保留来源、摘要和 Unicode 数据许可，见 [encoding-input.json](encoding-input.json)。所有依赖、样本和二进制均在被忽略的缓存中准备，没有改工作区 manifest 或锁文件。

## XML：内容完整性与禁止外部访问同时验证

[xml-bridge.c](xml-bridge.c) 用 Expat 的元素、文字、实体和错误回调生成源事实；由 [xml-parser.mjs](xml-parser.mjs) 合并逻辑文字，不创建活动文档。使用已固定的 Emscripten 6.0.12，五个上游 C 单元加一个桥接单元生成 142,557 字节 Wasm；上游 lib 目录源码逐项与固定归档比较，未修改。构建及许可见 [xml-build-contract.json](xml-build-contract.json)。

正常 FB2 的 UTF-8、UTF-16、内部实体、CDATA、注释、处理指令、换行和字符引用，与上一轮由 lxml／libxml2 独立生成的树一致。输入分块为 1、2、7、64 字节，结果不依赖回调拆分方式。

额外用例覆盖内部参数实体、属性实体、普通 DOCTYPE、不读取的外部 DTD、外部一般／参数实体及未使用的外部声明、未定义和递归实体、非法字符、namespace 错误、重复展开属性、损坏 UTF-8、编码声明冲突、深度／节点／输出预算和实体放大限制。每次失败后重新创建解析器，正常输入仍可通过；失败结果不包含可用源树。

仅有外部 DTD 声明而正文不依赖它时成功；需要其中未取得的实体时明确失败。这个行为与上一轮 Chromium 静默返回 `leftright` 的情况不同，上一轮失败证据保留在[源地址记录](../kana-source/source-addresses.md)。

XML ISO-8859-1 的 `0x80` 被保留为 U+0080，Windows-1252 的同一字节则是欧元符号。当前本机 Node 24.11.1 的原生 Windows-1252 解码观察还与规范索引不同；试件记录了实际码点，并对需要一致解释的单字节路径使用固定映射，未以编码名称相同推定结果相同。该观察只针对本次 Node 输入，不概括其他 Node 构建或浏览器。

本轮上限是试件参数，不是正式预算承诺。尚未验证所有声明编码、完整属性／树占用与大输入组合；也没有测量垃圾回收或整个浏览器进程内存。

## RAR：在原生解密之后、改名之前取得字节

[raw-name-hook.patch](raw-name-hook.patch) 只修改私有副本中的元数据交付点；成熟解码、头部校验和文件系统适配仍按原生流程执行。旧基础对象、旧试件和原始源码保持不变。新 Wasm 为 571,177 字节，构建、原始／修改后摘要和 UnRAR 许可见 [names-build-contract.json](names-build-contract.json)。

14 个 RAR5 派生文件仅改成员名及相关头部字段、重新计算头部 CRC，保留同一个原始压缩载荷；每份只保留一个普通成员。用例包括 Unicode、组合形式、Unix 字面反斜杠、非法 Windows 反斜杠、NUL、非法 UTF-8、原始长度超过 wasm32 位宽、绝对路径、根外父目录、百分号、宿主保留名以及格式定义的 Unix 原始字节映射标记。来源与修改方式见 [names-fixture-input.json](names-fixture-input.json)。这些是派生边界样本，不是 14 份不同出版物。长度用例的原始值是 2^32 + 1，原生 size_t 转换后会成为 1；候选在转换前保留长度并明确拒绝，不能只比较转换后的短值。

两份真实 Unicode 归档和两份加密文件名归档验证钩子位置：可以取得已经解密的源名字，不必让 JavaScript 重新解释加密头。旧 Unicode 样本中仍有一个不带编码字段的 UTF-8 名称，候选必须区分“有 Unicode 依据”和“显式指定 UTF-8 后可解释”。

另用 RAR3 派生名 `caf\x82.txt` 验证编码差异：固定 CP437 得到 `café.txt`，固定 Windows-1252 得到 `caf‚.txt`。格式自身不能替调用方确定意图。该派生文件只用于名称解释，未重写原有链接目标，不用于引用图验收。

损坏的旧式压缩 Unicode 名也不能只相信解码后的字符串：本轮构造的残缺操作码仍被原生路径解释成 `A`。候选在使用解码结果前验证编码单元、复制范围和完整消费，因而明确拒绝，而非把这次修复当成真实源名。

尚未穷尽极长名称、所有旧式 Unicode 损坏形状、混合档名编码、原始引用目标及整个引用图。窗口系统的提取限制也不能直接替代归档内部命名空间规则。

## EPUB：源图与 CFI 的关键差异

[prepare-epub.py](prepare-epub.py) 创建自有 EPUB 容器，浏览器实际使用 zip.js 解压并逐项校验摘要，然后关闭 ZIP 句柄。包中重复引用同一 XHTML，另有第二章、导航及通过 object 引用的 SVG 片段；没有运行外部 EPUBCheck。

[cfi-cases.mjs](cfi-cases.mjs) 覆盖转义 ID、合并文字、重复 spine 出现、跨元素文本断言、前后 side bias、三处空文字槽、两种虚拟边界、范围展开、嵌套引用与片段目标、时间／空间终点语法、百分号字面值，以及错误断言、代理对、越界和非法语法。保存完整 CFI 后，重新解析源 XML 并更换输入分块，仍恢复同一源位置与偏向。

此处不把 FB2 子节点编号当作 CFI 编号，也不根据断言去搜索替代目标。媒体时间终点只验证语法保留；没有执行书内音视频播放。全部 CFI 符合性、更多出版物、完整 DOM 到 CFI 的生成及跨章节交互仍须继续核对。

## MOBI：独立预期、重建和文字来源

六份 libmobi 上游样本包含 Windows-1252、UTF-8、未压缩、PalmDOC、HUFF/CDIC、普通 KF8 和组合文件。每份默认内容分支的完整原始流均匹配上游独立 MD5；旧分支的 HUFF/CDIC 与未压缩样本另得到相同 SHA-256。浏览器按显式分支重新解码全部 10 个分支，结果逐一匹配 Node 记录。MD5 仅用于与上游测试预期对应，来源和制品固定均使用 SHA-256。

原始记录去除附加数据后逐项解码，长度总和与 PalmDOC 声明相符。KF8 索引得到 10 份 skeleton 文档，重建字节保存其原始 documentIndex，没有进行资源替换或输出序列化；其内容再进入文字来源试验。

当前 parse5 的节点位置不能直接充当原始字符区间。实测一段空白 token 的范围包含后续 `&quot` 的源码，直接解码该区间会多出不属于这个 token 的文字。候选因此在字符与字符引用发射时保存来源，再通过 `_insertCharacters` 与 treeAdapter 跟随实际插入。试件使用固定版本的内部接缝。

来源对应包括多字节文字、展开为多个字符的引用、代理对、HTML 换行产生的零宽边界，以及表格修复造成的源／显示顺序差异。重新按另一组分块解析后，已存字节起点和 UTF-16 偏移恢复到相同文字节点边界；编码字符与字符引用内部的非法字节地址、半个代理对明确拒绝。

`fullMarkupMappingProved` 为 false：试验覆盖实际插入的文字，未验证所有显式词法回放、所有元素起始地址、被完整省略的内容、完整正文提取或任意 HTML 修复。也没有验证固定 KF8、内嵌字体／媒体转换、DRM、长书有界索引或实际阅读画面；不能把源流解压成功换算成这些功能通过。

## 复现

先准备此前的固定 UnRAR／Emscripten、zip.js、FB2 预期及 Electron 运行时，然后从仓库根目录执行：

```powershell
python -B refactor/verification/evidence/kana-formats/prepare-inputs.py
python -B refactor/verification/evidence/kana-formats/prepare-mobi.py
python -B refactor/verification/evidence/kana-formats/prepare-html.py
python -B refactor/verification/evidence/kana-formats/prepare-names.py
python -B refactor/verification/evidence/kana-formats/prepare-encodings.py
python -B refactor/verification/evidence/kana-formats/prepare-epub.py
python -B refactor/verification/evidence/kana-formats/build-xml.py
python -B refactor/verification/evidence/kana-formats/build-names.py
python -B refactor/verification/evidence/kana-formats/run-node.py
python -B refactor/verification/evidence/kana-formats/run-browser.py
```

固定输入、构建与运行分别保留摘要。上述结果回答本轮具体的设计疑问；未运行范围按各自问题继续记录，不用“还没有完整产品”替代设计结论，也不以几个成功样本宣称全部格式完成。
