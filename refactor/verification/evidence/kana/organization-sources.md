# Kana 工程组织的规范与接口依据

对应已确认的 [Kana 工程组织](../../../design/projects/kana/README.md)。工程组织轮只读取规范与库接口，未创建 Kana 独立仓库，未执行格式解析、浏览器排版或位置往返测试。后续已经执行的部分浏览器与 PDF／ZIP 试验单独记录在[阅读路线验证](reading-route.md)，不改写本页历史来源结果。

## 来源与设计影响

[source-probe.py](source-probe.py) 读取以下六项官方来源，记录 URL、实际响应地址、HTTP 状态、时间、字节数及 SHA-256；结果保存于 [organization-source-contract.json](organization-source-contract.json)。文档内容指纹用于说明本次读取对象，不代替依赖版本锁定，也不构成运行证明。

| 来源                                                                                                       | 已核对的事实                                                                                                    | 对组织的影响                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [EPUB 3.3 布局](https://www.w3.org/TR/epub-33/#layout)                                                     | 全局 rendition:layout 可以由 spine itemref 的布局属性覆盖，规范含固定与重排混合示例                             | 格式实例保留逐项版式；文档顺序、内容性质与当前分页方式分开                                            |
| [EPUB CFI](https://w3c.github.io/epub-specs/epub33/epubcfi/)                                               | 路径从 package/spine 进入内容；元素和字符数据按源规则寻址，文字偏移以 UTF-16 计数                               | EPUB 自身拥有源解释；展示包装和高亮不能改变持久地址                                                   |
| [PDF.js 文档输入](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)                         | getDocument 支持自定义 PDFDataRangeTransport、worker 及字体／字符映射等资源参数；输入字节也可能转交 worker 持有 | PDF 适配拥有库句柄与 worker；resources 提供范围读取，发行同时装配依赖资源                             |
| [zip.js Reader](https://gildas-lormeau.github.io/zip.js/api/classes/Reader.html)                           | 自定义 Reader 提供 size、按 offset/length 读取以及范围流入口                                                    | ZIP 可接入宿主授权字节源，供 EPUB 和图片归档共用；这不证明 RAR 的读取或解压行为                       |
| [HTML iframe sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox) | 脚本、同源、表单和导航等能力分别受限制；同时恢复同源与脚本具有明确风险                                          | 隔离由 view 中的受限呈现拥有，资源过滤及真实浏览器行为仍须验证，不能只添加一个 sandbox 属性就宣布完成 |
| [DOM Range 边界](https://dom.spec.whatwg.org/#concept-range-bp-set)                                        | 当边界节点属于不同根时，设置一端会调整另一端；单个 Range 不跨独立文档树                                         | 多文档呈现需要 Kana 自己协调跨章节逻辑选区，不能假定原生选择自动覆盖所有 iframe                       |

这里只将相关原生接口作为组织依据。PDF.js 和 zip.js 的文档并未锁定正式依赖版本；本轮也没有据此选定 RAR 后端、隔离文档的最终组合方式或全部格式解析器。

## 实际执行范围

```powershell
python refactor/verification/evidence/kana/source-probe.py
```

脚本只读取公开页面并检查引用的关键接口名称仍可找到，不安装或执行远程代码，不打开书籍，不启动浏览器或解码 worker。其结果与人工阅读共同支持上表的来源记录；并不验证读者能够连续选择、恢复位置或在大文件下保持有界内存。

格式、定位与完整 Reader 的运行验证按[阅读验收](../../scenarios/reading.md)核对。
