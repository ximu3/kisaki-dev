# Kana 格式与输入验证

2026-10-20，本轮继续验证 XML 候选、URL 稳定字节输入与图片页序，为[格式解析与输入设计](../../../design/projects/kana/formats.md)提供依据。此前 CFI／MOBI 的运行记录仍见[联合格式验证](format-sources.md)与 [Foliate 对照](../kana-foliate-review/reassessment.md)；本轮没有新增固定 KF8 或完整 CFI 的通过声明。

后续独立试件已补充 [CFI 完整语法与显示绑定](../kana-cfi/cfi.md)、[固定 KF8 二进制页面](../kana-kf8-fixed/fixed.md)。本页保留当时结果，不将后续覆盖追记成原试件已执行的检查。

所有新增代码都是隔离机制试件。没有运行正式 Reader，也没有修改应用源码、工作区依赖或锁文件。浏览器使用此前固定的 Electron 44.5.1／Chromium 152.0.7977.130，在隐藏窗口中关闭 renderer 的 Node 接入；XML 和 HTTP 试验均没有外部网络请求。准备固定公开依赖、规范和数据时的下载另见输入记录。

## XML 候选：同一源解释预期

输入与版本保存在 [source-input.json](../kana-xml-input/source-input.json)：saxes 6.0.0、@xmldom/xmldom 0.9.12、fast-xml-parser 5.11.2 及固定传递依赖。使用 registry integrity 与逐文件 SHA-256 核对；没有执行包安装脚本。比较通过公开解析 API 进行，不修改候选包。

[cases.mjs](../kana-xml-input/cases.mjs) 的 24 个输入包括文字、空白、namespace、内部一般／参数实体、实体替换标记、默认属性、标准 XHTML 实体、内部覆盖、未使用与实际使用的外部声明，以及非法引用、重复展开属性等边界。匹配依据是 Kana 需要的源文字、结构和明确失败，不是完整 XML 符合性测试集。

| 候选                      | 分块与执行数               | 匹配本次预期 | 影响选型的差别                                                |
| ------------------------- | -------------------------- | ------------ | ------------------------------------------------------------- |
| Expat 2.9.0＋标准本地目录 | 1／17／4096 字节，共 72 次 | 72           | 本次源解释与明确失败均匹配                                    |
| saxes 6.0.0＋标准实体表   | 1／17／4096 字符，共 72 次 | 57           | 内部 DTD 的实体、替换标记、默认属性与目录覆盖未取得预期结果   |
| xmldom 0.9.12             | 每项完整字符串，共 24 次   | 15           | 内部实体、非法引用、重复展开属性与部分 XHTML 实体规则存在差异 |
| fast-xml-parser 5.11.2    | 两种实体配置，各 24 次     | 8／12        | 内部 DTD、规范化、namespace 和部分非法输入存在差异            |
| Chromium DOMParser        | 每项完整字符串，共 24 次   | 19           | 内部参数实体及部分外部实体依赖被静默省略                      |

这里的分母不同，不能将它们当作性能或通用质量排名。JavaScript 候选使用字符串输入，因此字节编码不包含在这组比较中。xmldom 按资源使用 XML／XHTML MIME，并在诊断回调中中止；fast-xml-parser 同时运行默认实体行为与公开 EntityDecoder 配置，保留顺序和文字并启用校验；saxes 为明确标准 XHTML 输入预置完整命名实体。配置与实际观察见 [compare.mjs](../kana-xml-input/compare.mjs)。没有额外实现 DTD 解释器来改变候选的语义范围。

Node 24.11.1 的完整观察见 [node-contract.json](../kana-xml-input/node-contract.json)。真实 DOMParser、相同 JavaScript 候选及独立 worker 的结果见 [browser-contract.json](../kana-xml-input/browser-contract.json)。浏览器 DOMParser 的错误元素判断仅用于这些不含作者自定义 parsererror 元素的受控输入，不能复制为正式通用错误识别器。

## Expat：标准目录、编码与终止

新 [bridge.c](../kana-xml-input/bridge.c) 通过 Expat 外部子集回调装入本地目录；不开放网络或文件读取。目录直接解码自 [HTML XML 解析规则](https://html.spec.whatwg.org/multipage/xhtml.html#parsing-xhtml-documents)内嵌的 DTD，保留其 11 个 public identifier，58,845 字节。使用独立 [entities.json](https://html.spec.whatwg.org/entities.json) 核对 2125 个名称在文字和属性中的值，再与实际浏览器 DOM 树逐项对照。属性中的 TAB／CR／LF 按 XML 规则规范化为空格。

这解决了[此前发现](../kana-foliate-review/reassessment.md)的正常 XHTML 标准实体缺口。普通未知外部子集按非验证处理跳过；随后需要其中未取得的一般实体时失败。未使用的外部一般实体声明可以存在，实际引用则明确失败。内部实体与内部对标准名称的覆盖正常处理。没有将外部 DTD 省略描述为执行了验证或取得其默认属性。

构建复用先前固定的 Expat 2.9.0 提交及 Emscripten 6.0.12；上游源码与旧试件不变，新 Wasm 为 146,818 字节，见 [build-contract.json](../kana-xml-input/build-contract.json)。原生堆初始为 16 MiB，上限 64 MiB；桥接限制元素深度、元素数、展开文字和元信息，实体放大另用 Expat 机制。固定可信目录不计入书籍实体声明额度，但仍占原生堆。上述数值是试件参数，不是正式预算合同。

[boundaries.mjs](../kana-xml-input/boundaries.mjs) 对 UTF-8、UTF-16LE／BE、XML ISO-8859-1、Windows-1251／1252、损坏 UTF-8、BOM／声明冲突及六类预算输入做了 30 次执行；每次失败后重新解析正常输入。XML ISO-8859-1 的 0x80 保留为 U+0080；Windows-1252 使用固定表得到 U+20AC，避免混淆两种编码。三份既有、经过 schema 校验的 FB2 在三种分块下共做 9 次比较，匹配 lxml／libxml2 产生的独立源树。

worker 中不提供 DOMParser，也没有 Node；同样的源比较、实体目录、编码／预算及 FB2 预期均通过。另一任务解析 16 MB 合成输入，在真实 C 解析回调首次交付事件后终止 worker，20 ms 观察窗口内未交付完成结果；新 worker 随后正常执行完整测试。这支持隔离与强制终止路径，不证明物理内存何时回收、worker 池如何调度或全部取消竞态已验证。

尚未覆盖完整编码声明识别、其他多字节编码、全部输入量／对象内存预算、实体放大与超大名称组合、真实大书索引及所有发布形态。失败时没有发布部分源树，不代表所有资源耗尽都已被映射为正式 ReadingFailure。

后续[扩展编码对照](../kana-xml-codecs/codecs.md)和[完整编码入口试件](../kana-xml-entry/entry.md)已补充固定 libiconv、CP932 校正、BOM／声明、别名、格式编码限制及实际 worker 按需加载。上面的运行数据保留原样，后来补齐的机制按其独立记录解释。

## URL：真实 HTTP、CORS 与临时存储

[browser.cjs](../kana-url-input/browser.cjs) 启动两个本机 origin，实际浏览器 Fetch 进入 [probe.mjs](../kana-url-input/probe.mjs) 的私有候选适配；没有用模拟响应代替浏览器 CORS。临时文件通过真实 OPFS 创建、写入、关闭和删除。19 个场景的请求头、观察和断言见 [browser-contract.json](../kana-url-input/browser-contract.json)。

范围方式要求实际 206、强 ETag、合法 Content-Range、稳定总长，以及能核对其字节坐标。后续使用 Range＋If-Match；正确的请求、范围响应和读取缓冲的独立性通过。返回 412、改变强 ETag 或最终 URL 不会采用新版本；区间错误、短响应、验证头消失、后续忽略 Range 的 200 被归为读取失败，不伪称内容一定改变。服务器错误复用强 ETag 不在客户端可证明的范围内。

CORS 测试覆盖必要头部不可见、仅部分暴露、明确可见的暴露列表与通配符，以及 credentials 为 include 的规则。Content-Encoding 读为 null 不足以证明不存在编码；候选仅在能验证编码信息时允许远程范围输入。这也说明某些合法服务器会被保守地放入快照路径，是为保证文件字节坐标付出的取舍。

服务器忽略 Range 时采用同一 200 响应流；弱 ETag 的部分响应被丢弃，随后的完整 GET 特意返回不同字节，证明没有将旧前缀拼入快照。gzip 场景的 HTTP Content-Length 为 24，Fetch 交付 128 字节；候选按后者计算实际大小与预算。当前 Chromium 对违背其 identity 请求的范围压缩响应，在 Response 交付前报网络解码失败；试件因此在打开阶段尝试一次普通 GET，未按错误消息文本分类。输入发布后不做此转换。

打开 signal 在交付之后触发不会关闭 source；单次范围读取取消后 source 可继续使用；dispose 使尚未结束的读取完成收尾。取消快照发生于实际写入之后。整个运行创建 8 个临时文件并删除 8 个，最终存活为零；服务端观测到 3 次未完成响应被取消。超出解码字节预算时没有发布部分输入。

这些结果没有覆盖所有暂存失败注入、权限／认证部署、缓存代理、网络浏览器组合、大文件吞吐或正式包里的资源调度。规范依据为 [HTTP 条件与范围请求](https://www.rfc-editor.org/rfc/rfc9110.html)及 [Fetch 的响应过滤和 CORS 规则](https://fetch.spec.whatwg.org/)。

## 图片页序：固定数据与全序

[source-input.json](../kana-image-order/source-input.json) 固定 Unicode 18.0.0 的 [UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt) 与已有 CaseFolding 数据。候选按路径段组织自然比较：默认完整大小写折叠、Nd 整数、同值数字的宽度及原名补序；不使用 Intl、系统语言或浮点数值转换，不修改成员名。

[cases.mjs](../kana-image-order/cases.mjs) 覆盖 12 组手写预期：普通页码、大小写、前导零、分层目录、全角与阿拉伯数字、超安全整数、组合形式、完整折叠展开、补充平面字符、数字与非数字的比较，以及标点。数字统一参与比较键，避免把非 ASCII 数字的原始码点与数值比较混用后形成循环。

[node-contract.json](../kana-image-order/node-contract.json) 记录 102 个不同路径的 5151 对检查：所有排序后的前后项严格一致、反向比较相反且没有两个不同路径并列；64 次固定种子打乱后顺序相同，并对固定数据中的 770 个十进制数字核对数值次序。它只验证比较机制，没有新执行真实 ZIP 提取、图片识别、页面解码或损坏页处理。

## 复现

复用原有已固定的 Expat／Emscripten、FB2 预期、Unicode CaseFolding 与 Electron 缓存后，从仓库根目录运行：

```powershell
python -B refactor/verification/evidence/kana-xml-input/prepare.py
python -B refactor/verification/evidence/kana-xml-input/build.py
node refactor/verification/evidence/kana-xml-input/run-node.mjs
python -B refactor/verification/evidence/kana-xml-input/run-browser.py
python -B refactor/verification/evidence/kana-url-input/run.py
python -B refactor/verification/evidence/kana-image-order/prepare.py
node refactor/verification/evidence/kana-image-order/run-node.mjs
```

网络来源、构建输入和执行脚本分别保留摘要。WHATWG 活规范与数据重新下载时须核对保存的来源摘要，不能假设日后的同一 URL 永远返回本轮字节。上述取舍随后已获确认；本页保留实际覆盖范围，设计确认不把未覆盖项折算为通过。
