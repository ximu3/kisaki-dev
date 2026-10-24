# 参考内容、选择与跳转的设计核对

2026-10-19，本轮核对 Foliate 的实际注释交互源码与数字出版、焦点交互规范，用于[阅读行为](../../../design/projects/kana/api.md)。这次是源码与规范核对，没有运行 Foliate 应用、执行新的浏览器交互试件或采用上游代码。

## 固定来源

Foliate gtk4 分支的本次 HEAD 为 `67b6676d3f936c5edea91d4d903385ef39dd25c0`；它的 src/foliate-js 子模块固定于 `399248a67a8862ffb5e6463a33f9d52b317ca2eb`。这里跟随应用实际使用的子模块，不能混同此前用于其他格式对照的 foliate-js 提交。

三份未修改源码的 URL、缓存位置与 SHA-256 见 [source-input.json](source-input.json)。主要读取 [Foliate reader.js](https://github.com/johnfactotum/foliate/blob/67b6676d3f936c5edea91d4d903385ef39dd25c0/src/reader/reader.js)和该子模块的 [footnotes.js](https://github.com/johnfactotum/foliate-js/blob/399248a67a8862ffb5e6463a33f9d52b317ca2eb/footnotes.js)。

## 实际源码呈现的选择

| 部分               | 源码观察                                                     | 对 Kana 的启发或边界                                             |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 参考识别           | 读取 EPUB 类型和 ARIA 角色，另有按上标样式猜测的分支         | 显式语义可以参考；样式猜测不是已确认的本库规则                   |
| 临时呈现           | 复用 book 创建临时 foliate-view，以滚动视图放入对话框        | 临时查看可以与主阅读位置分开，不等于重新打开一个业务阅读会话     |
| 内容取得           | 从目标文档抽取 Range 内容，再替换显示文档的 body             | 若临时内容允许保存位置和标注，需要额外保证原始源映射和布局上下文 |
| 关闭与进入         | 关闭临时视图；选择 go 时再让主视图定位，部分目标不显示 go    | “结束查看”和“进入目标”有不同含义，具体可用性应按目标判断         |
| 查看中的链接与失败 | 该应用会将内部链接送往主视图，部分处理失败也会改为主视图跳转 | 这是该应用的策略，不直接成为 Kana 的默认行为                     |

这些观察支持比较交互方式，未证明其片段视图满足 Kana 的可恢复标注、跨范围选择、readView 或全部取消规则，也不据此评价该项目未承诺的能力。

## 语义与可访问性参考

[DPUB-ARIA 1.1](https://www.w3.org/TR/dpub-aria-1.1/#doc-noteref)区分注释引用和注释内容，可用于核对明确的内容语义。是否临时呈现仍由阅读器判断，不能把普通小字号或短段落自动当作注释。

可选中文字、滚动并进入链接的参考内容需要可交互的显示与焦点安排。[APG tooltip 模式](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)明确提示 tooltip 不接收焦点；该模式仍是工作稿。[对话框模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)提供了进入、关闭与焦点返回的参考，但不替 Kana 决定必须使用模态对话框。

## 当前比较的范围

本次来源核对涉及主阅读位置、临时查看、选区及源位置的关系；具体行为由[交互合同](../../../design/projects/kana/interaction.md)定义。
