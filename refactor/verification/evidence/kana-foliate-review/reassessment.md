# foliate-js 的具体实现对照

本轮参考用户给定的 [foliate-js](https://github.com/johnfactotum/foliate-js)，核对格式转换、CFI、资源及呈现相关的具体实现。2026-10-19 的 HEAD 仍为 `78914aef4466eb960965702401634c2cb348e9b1`，与此前只核对 MOBI 算法时使用的提交相同；这次覆盖 34 份源码、文档和测试，见 [source-input.json](source-input.json)。

这些对照用于检验 Kana 既定设计中的具体技术判断。库的目标、职责、模块边界、公开接口和状态归属仍以已确认设计为依据。本轮证据不构成扩大 Foliate 代码采用范围或调整整体设计的结论；具体算法是否适合取用，按本库要求单独评估。机制试件同样只证明已覆盖的行为，不能自行决定正式模块、XML 依赖或新增文件字段。

## 可参考的具体实现与适用范围

| 部分       | foliate-js 的做法                                                                 | 用于检验的具体问题                                           |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| CFI        | 独立模块处理逻辑文字槽、CDATA、忽略／跳过注入节点、Range 转换和范围组合，并有自测 | 索引与转换算法、边界用例，以及与严格源定位语义的差异         |
| FB2        | 显式转换表处理正文、诗歌、表格、注释及图片，生成章节文档                          | 格式语义覆盖、转换时保留原 XML 节点对应的条件                |
| MOBI／KF8  | 记录解析、解压、索引、skeleton／fragment 重建、资源与导航各有实际处理             | 记录与重建算法、原始字节保留、分支恢复及缓存代价             |
| 资源与呈现 | section 的 load／unload／createDocument、资源引用计数、独立分页与标记层           | 资源引用与释放的局部机制；完整排版和跨浏览器表现未在本轮验证 |

主要来源为 [README](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/README.md)、[epubcfi.js](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/epubcfi.js)、[fb2.js](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/fb2.js)和 [mobi.js](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/mobi.js)。源码为 MIT；采用时保留固定来源、许可及实际修改，不直接继承不稳定的上游公共接口。

## 直接运行得到的合同差异

在同一 Electron 44.5.1／Chromium 152 环境中运行未修改的上游模块与测试。上游 CFI 测试的 **104 个 console.assert 全部通过**；追加对照记录见 [browser-contract.json](browser-contract.json)。这些结果不构成对整库质量或完整阅读体验的评价。

| 对照输入                                            | 实际观察                                                                  | 技术判断                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 同一 manifest 项在 spine 出现两次                   | 第二个 itemref 的 CFI 被 resolveCFI 返回为 index 0，预期源出现为 index 1  | 需要按真实 itemref 出现位置恢复，不能只按 idref 找第一个匹配项            |
| 路径指向第一个段落、终点 ID 断言指向第二个段落      | toElement 返回第二个段落                                                  | 上游支持按 ID 纠偏；Kana 的严格定位要求逐步核对，不能自动重新绑定         |
| 错误的文本断言                                      | toRange 仍返回 Range                                                      | CFI 语法工具不能代替完整断言校验                                          |
| 前导零、时间终点                                    | 前导零被接纳；序列化丢弃 `~0`；两个不同时间值的 compare 返回 0            | 需要补齐严格值检查、终点保留与比较，不能原样宣称完整 CFI 合同             |
| 正常 UTF-8 FB2 与内部实体样本                       | 均成功转换为三个章节                                                      | 为语义转换提供参考与正常样本证据，尚未验证源节点映射                      |
| 已通过 schema 校验的 UTF-16 FB2 样本                | 本次 makeFB2 抛出 TypeError，没有成功打开                                 | 编码入口需要补齐；该观察限于本次样本和提交                                |
| 含外部实体的 FB2                                    | 成功打开，目标文字为 `leftright`，实体内容静默省略；没有外部请求          | 原生 DOMParser 的内容完整性问题在实际格式入口中仍然存在                   |
| 标准 XHTML 1.0／1.1 DOCTYPE 下的 `&nbsp;`、`&copy;` | Foliate 的 loadDocument 正常返回不换行空格和版权符号；当前 Expat 候选拒绝 | 上一轮候选还缺标准 XHTML 实体处理，不能因拒绝更多输入就推断格式支持更完整 |
| FB2／MOBI 的默认定位输出                            | View.getCFI 返回转换后章节上的 CFI                                        | 它不是 Kana 的 FB2 nodePath 或 MOBI／KF8 原始字节地址                     |
| 组合 MOBI／KF8                                      | 原始首分支 version 6，默认选中 version 8                                  | 恢复既有旧分支地址时，需要显式保留和选择相应分支                          |
| RAR／CBR                                            | makeBook 返回 UnsupportedTypeError                                        | Foliate 的 CBZ 路线不能作为 RAR 名称或编码策略的既有答案                  |

CFI 与 EPUB 的差异分别对应 [partsToNode／toRange](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/epubcfi.js)和 [Resources.resolveCFI](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/epub.js)。这些观察给出了需要独立检验的规则；若取用相关代码，还须评估局部修改和维护成本。

本次对非 EPUB 定位只调用了上游实际的 View.getCFI 方法，没有渲染完整 View。格式入口、DOMParser 和 Range 均为真实浏览器执行；没有模拟一个浏览器 Range 来推断这些结果。窗口隐藏运行，Node 未暴露，外部请求为零。

## 不能从参考项目直接推导的选择

**XML 引擎。** 本轮在实际格式入口中观察到浏览器 DOM 对正常样本的处理，也暴露了 Expat 试件的兼容性缺口：标准 XHTML 的两个公共标识下，浏览器在没有网络请求时解释了命名字符实体；Expat 候选把它们当作未取得的实体而失败。未知外部 DTD 下，浏览器又会静默省略同样的引用。两类情况必须分别处理。[HTML 的 XML 解析规则](https://html.spec.whatwg.org/multipage/xhtml.html#parsing-xhtml-documents)定义了标准外部标识与命名字符集合的对应，因此不能把所有外部标识都按同一条拒绝规则处理。

Expat 试件仍是有效候选，但“已验证可行”不足以证明“必须统一采用它”。应按正常格式兼容、明确失败、源树一致性、编码、worker／增量能力和维护成本，比较浏览器 DOM 路线、成熟纯 JavaScript 解析器与 Expat，再确定依赖。此轮没有验证另外两种路线已经满足全部要求，也没有修改 Expat 试件来掩盖这次发现。

**RAR 编码公开接口。** Foliate 不支持 RAR，无法据此选择或否定 rarNameEncoding。旧编码歧义本身已有证据；从这个事实直接推出新错误码、两个文件表字段及一组额外编码支持，仍需要结合完整文件读取条件论证。上一轮具体字段保留为备选，不作为此次要求立即确认的新增合同。

**源位置。** Foliate 默认把非 EPUB 位置统一到生成章节的 CFI。Kana 已确认保存 FB2 原始逻辑路径、MOBI／KF8 原始字节以及归档成员身份；这些含义决定了解析与转换必须保留来源映射。参考实现的地址形式不改变本库持久合同。

**资源与呈现。** 其按需资源加载提供了局部机制参考。FB2 入口会读取整个文件并构造 DOM，旧 MOBI 初始化会汇集全部正文记录，KF8 使用累计头／尾缓存。view 按整本书的 rendition 选择一个呈现器，iframe 的当前 sandbox 又包含 allow-scripts。这些是具体实现取舍；不能直接推定满足 Kana 的全部资源、逐项混合版式、跨章节选择和隔离合同。本轮只核对相关源码，没有完成其完整排版或跨浏览器测试。

## 对既有技术方案的影响

XML 候选比较需要补入正常 XHTML 实体用例；CFI 和格式转换需要覆盖本次发现的严格定位、编码与分支恢复问题。这些是局部技术方案与验证范围的修正。XML 选型和旧 RAR 输入分别比较，算法取用按具体要求评估；不由参考项目的做法推定本库的模块组织、公共配置或数据模型。

正式解析与格式边界见[格式设计](../../../design/projects/kana/formats.md)；本页只记录所列参考实现与试件的观察。

复现本轮比较：

```powershell
python -B refactor/verification/evidence/kana-foliate-review/prepare.py
python -B refactor/verification/evidence/kana-foliate-review/run.py
```
