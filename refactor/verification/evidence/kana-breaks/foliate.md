# Foliate 的作者断页处理

2026-10-20 核对 foliate-js 的 HEAD，仍为 78914aef4466eb960965702401634c2cb348e9b1。使用[既有来源记录](../kana-foliate-review/source-input.json)固定的未修改源码，并运行实际 EPUB loader 与 Paginator，见 [foliate.cjs](foliate.cjs)和 [foliate-contract.json](foliate-contract.json)。

桌面 Foliate 的受查提交为 67b6676d3f936c5edea91d4d903385ef39dd25c0，其 foliate-js 子模块为 399248a67a8862ffb5e6463a33f9d52b317ca2eb。两个库提交的 paginator.js 字节摘要相同，均为 51cec81572d5d182e231fe68ce9c3b5489a0976b36172060516336ba893565ea；本轮没有运行桌面应用本身。

## CSS 替换与原生分栏

[Paginator.open](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/paginator.js#L646-L665)监听书籍资源转换事件，只处理 type 为 text/css 的资源，进行以下文本替换：

| 原声明                    | 替换后的声明                        |
| ------------------------- | ----------------------------------- |
| page-break-before: always | -webkit-column-break-before: always |
| break-before: page        | break-before: column                |
| break-inside: avoid-page  | break-inside: avoid-column          |

对应 after、before、inside 均由同一组规则覆盖。转换之后，[columnize](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/paginator.js#L309-L339)设置原生 column-width、column-gap、column-fill:auto 与视口尺寸，由浏览器完成片段化。受查路径没有独立解析断点并为 Firefox 补齐强制断页的分页算法，也没有以这些替换实现完整左右页约束。

[EPUB loader](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/epub.js#L847-L879)会处理内嵌 style 元素及 style 属性里的资源地址，但它们没有作为独立 text/css 资源触发上述转换。外部 CSS 与这两种内嵌位置因此存在实际差异。

## 直接运行结果

每个引擎运行九组横排场景：三种声明位置分别使用现代 page 与旧 always 写法，再检查外部 CSS 中的 left、right 和 auto。每组两块内容 A、B 均为 60px 高，阅读面为 300×400px，单栏、零间隔；两块原本可以放在同一面，用 B 的实际矩形判断强制断页。

| 输入                        | Chromium 149.0.7827.55  | Firefox 153.0            | Windows WebKit 26.5     |
| --------------------------- | ----------------------- | ------------------------ | ----------------------- |
| 外部 CSS：page／旧 always   | 转为 column，进入下一栏 | 转换值未生效，仍在当前栏 | 转为 column，进入下一栏 |
| style 元素：page／旧 always | 仍按 page 解释，未换栏  | 仍按 page 解释，未换栏   | 仍按 page 解释，未换栏  |
| style 属性：page／旧 always | 仍按 page 解释，未换栏  | 仍按 page 解释，未换栏   | 仍按 page 解释，未换栏  |
| 外部 CSS：left／right       | 未换栏                  | 未换栏                   | 未换栏                  |
| 外部 CSS：auto 对照         | 未换栏                  | 未换栏                   | 未换栏                  |

外部 CSS 的现代与旧写法在 Chromium 中使 B 从 x=0、y=60 进入 x=300、y=0；WebKit 的对应新栏位置为 x=300、y=1。Firefox 的计算 break-before 为 auto，B 仍在 x=0、y=60。这里验证是否强制进入下一栏，没有把不同引擎的完整边缘几何判为等价。

27 组正文始终为 AB；外部请求为零。最终记录没有页面异常。一次早先运行曾观察到 Firefox 的选择回调读取空 Selection，最终运行未复现；本轮不据此评价或宣称通过完整选择与销毁行为。

## 桌面应用与浏览器库的区别

桌面 Foliate 的 [WebView](https://github.com/johnfactotum/foliate/blob/67b6676d3f936c5edea91d4d903385ef39dd25c0/src/webview.js#L1-L4)直接使用 WebKit。foliate-js 的 [README](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/README.md#the-paginator)明确采用 CSS 多栏，并说明部分 CSS 与浏览器问题仍是限制；其浏览器支持目标不能推导为每个排版属性在所有引擎中等价。

章节之间的加载切换由 sections 与导航处理，固定版式另用 fixed-layout.js；这两类边界不能等同于本轮检查的章节内部 CSS 强制断页。这里没有运行实际 WebKitGTK、Safari、桌面 Foliate，也未测试竖排、双面、完整 CSS 冲突解析或真实 EPUB 归档解包；输入直接交给未修改 EPUB 类的文件读取接口。

```powershell
node refactor/verification/evidence/kana-breaks/foliate.cjs
```

本轮没有采用或修改上游代码。后续已确认[作者断页规则与 Kana 的责任](../../../design/projects/kana/layout.md)，这份记录仍只说明 Foliate 的具体适配范围，以及受查源码并未提供已经闭合的 Firefox 断页补齐路径。
