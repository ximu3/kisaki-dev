# TXT 与 FB2 源地址往返验证

2026-10-19，13 份 TXT 和 3 份 FB2 自建文件在 Windows x64、Electron 44.5.1／Chromium 152.0.7977.130 下完成 64 次关闭重开。2,908 次位置恢复、5,372 次范围恢复均与预期一致。它们分别对应 727 个样本位置和 1,343 个样本范围，在四组输入／展示分块条件下重复验证；不是对所有文件或全部格式的覆盖声明。

本轮落实已确认的[源位置合同](../../../design/projects/kana/positions.md#addresses)，没有增加公共地址字段或改变计数规则。试件使用真实 TextDecoder、DOMParser、Text 节点和 Range，但尚未实现正式 Kana reader、FB2 阅读转换或 Kisaki 保存接入。具体结果见 [browser-contract.json](browser-contract.json)。

XML 实体处理的补充实验见[联合格式验证](../kana-formats/format-sources.md)。本页 DOMParser 结果保留其实际成功与失败，正式解析入口见[格式与输入](../../../design/projects/kana/formats.md#xml)。

## 输入与独立预期

[prepare-fixtures.py](prepare-fixtures.py) 生成可复现的受控源文件。TXT 的预期文字直接声明；FB2 由 Python lxml／libxml2 独立解析并生成预期逻辑树，再与浏览器结果逐项比较。三个 FB2 文件都通过 gribuser/fb2 固定提交 `4d3740e319039911c30d291abb0c8b26ec99703b` 的 XML Schema 校验；schema 保留原有许可。文件、schema 和预期记录的摘要见 [fixture-input.json](fixture-input.json)。

这些文件是自建样本，没有使用出版物或用户书籍。schema 校验用于确认本轮正常样本有效，不是正式 reader 的逐文件必经流程，也不代表完整 FB2 合规测试。

| 输入                                          | 覆盖的解释条件                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| UTF-8、UTF-16LE／BE                           | 匹配 BOM 的消费，原有 CRLF／CR／LF、制表符、不换行空格、组合字符和补充平面字符         |
| Shift_JIS、GB18030、Windows-1252、ISO-2022-JP | 多字节边界、四字节字符、单字节映射和跨块保持的编码状态                                 |
| 损坏的 UTF-8／UTF-16                          | 默认替换行为、截断的末尾序列、孤立代理码元和末尾冲刷                                   |
| 空文件、只有 BOM、中间 BOM、相反端序 BOM      | 空序列的零位置；只消费匹配的开头 BOM，不依它改写已确定编码                             |
| UTF-8／UTF-16 FB2                             | 空白子节点、属性与 namespace、注释／处理指令排除、CDATA 合并、字符引用、XML 行结束处理 |
| 含内部实体的 FB2                              | 内部实体展开后的逻辑文字、UTF-16 地址和重开稳定性；没有一概拒绝所有 DOCTYPE            |

编码行为依据 [WHATWG Encoding](https://encoding.spec.whatwg.org/#interface-textdecoder)。FB2 行结束及字符引用依据 [XML 1.0](https://www.w3.org/TR/xml/#sec-line-ends)；正常结构依据 [FictionBook schema](https://github.com/gribuser/fb2/blob/4d3740e319039911c30d291abb0c8b26ec99703b/FictionBook.xsd)。

## 实际往返过程

输入分别以 1、2、7、64 字节送入流式解码器；展示文字分别以 1、3、5、17 个 UTF-16 单位为目标分块，实际分块避开代理对中间。每个样本中的合法文字边界和 FB2 元素位置均经展示节点反向取得源地址，序列化为现有 ReadingLocation 形状，再关闭源模型和展示索引。

重开时重新读取源文件、核对字节摘要、重新解码及解析，并改用另一组输入与展示分块。持久地址必须恢复到相同源节点及偏移，不能依靠旧 DOM、旧节点对象或原来的分块索引。包装元素、高亮式包装和装饰文字均不参与源编号；对装饰节点的反向定位明确失败。

TXT 枚举样本中所有合法端点组成的非空半开范围。FB2 覆盖各文字节点、相邻节点、全树和跨正文两章的指定范围；所有位置均枚举，但没有穷举 FB2 的全部端点组合。范围经过真实 Range 创建、内容克隆、装饰去除，再与独立预期比较。

FB2 的源树比较包括 metadata 和实际空白；本轮范围比较的是源文字映射，不是阅读正文提取规则，也不是可跨独立章节文档直接使用一个原生 Range 的声明。正文／注释、隐藏内容、段落分隔和摘录规则继续按[内容合同](../../../design/projects/kana/content.md)实现与验证。

四组条件共拒绝 76 次切开代理对的地址；组合字符之间仍是合法 UTF-16 边界。负数、小数、越界、错误编码、缺失节点、文字节点缺少偏移、元素节点带文字偏移和关闭后访问均明确失败。关闭后，试件自己的源／展示索引与挂载节点归零；未测量垃圾回收或完整浏览器进程内存。

## XML 入口发现的缺口

单独检查七项损坏或外部引用输入后，确认 DOMParser 不能直接成为已经验证的 FB2 解析入口：

| 输入                                 | 实际观察                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| 外部 DTD                             | 试件检测到 systemId 并明确拒绝                                                         |
| 外部一般实体、外部参数实体、网络实体 | 当前 Chromium 不发起请求，但把对应文字静默省略；样本文字由含引用的输入变成 `leftright` |
| 标签未闭合、未声明实体、非法字符引用 | 检测到 XML 解析错误，明确拒绝                                                          |

损坏 XML 的错误节点可能位于原根元素内部，且使用 XHTML namespace。只检查根节点或 Firefox 常见的错误 namespace 会漏掉此次 Chromium 的错误；试件已覆盖这种情况。

`externalRequests` 和 `entityRequests` 均为零，只能证明这组用例未访问外部资源。`externalEntityAdmissionComplete` 明确为 false：不加载外部实体还必须与源内容完整性一起处理，不能把静默省略后的树当成可靠地址依据。正式 XML 入口仍须验证能明确识别这种不完整解释，并控制实体展开及树规模；本轮没有用正则过滤或禁用全部 DTD 来替代这一要求。

## 尚未覆盖

TXT 的所有规范编码、首次编码识别、真实长文件与有界索引；FB2 的完整 XML 编码入口、实体处理、正文／注释转换及内嵌资源；Firefox／WebKit；EPUB 的完整 CFI、MOBI6／KF8 字节映射；以及完整选区交互、正式包和应用保存重开，均仍须继续验证。

试件为核对预期会持有完整小文件和逻辑树，不能据此宣称大书有界读取已经实现。`productionReaderExecuted` 与 `allFormatsValidated` 均为 false。

复现入口使用现有 Python（含 lxml）、Node 与先前固定的 Electron 运行时，不改工作区依赖：

```powershell
python -B refactor/verification/evidence/kana-source/prepare-fixtures.py
python -B refactor/verification/evidence/kana-source/run-browser.py
```
