# 章节布局上下文与字体完成的浏览器对照

2026-10-19，使用隐藏的 Electron 44.5.1／Chromium 152 文档核对两个会影响阅读路线的假设。输入全部为本试件生成的短 HTML 和两份故意无效的字体响应；没有读取用户文档。结果见 [browser-contract.json](browser-contract.json)，代码见 [probe.cjs](probe.cjs)。本轮讨论引用的八份规范页面、内容摘要与锚点检查见 [references.json](references.json)。

## 源标记相同，不足以证明拆分后的呈现等价

两个 iframe 使用相同样式和相同目标段落。完整文档还包含目标段落之前的标题和段落；片段文档只留下同一个父元素和目标段落。两个目标的文字与 data-source 标记完全相同。

| 观察项                         | 完整上下文     | 只保留目标片段 |
| ------------------------------ | -------------- | -------------- |
| :nth-of-type(2) 参与的文字颜色 | rgb(0, 120, 0) | rgb(0, 0, 0)   |
| :first-child 参与的字号        | 16px           | 32px           |
| 相邻兄弟选择器参与的缩进       | 24px           | 0px            |
| 表格目标单元格宽度             | 208px          | 16px           |

表格对照保留相同的目标行，只移除了另一行中的长文字。这表明当前单元格的宽度也可能取决于未显示的其他行。

该结果反驳“只要源端点能恢复，章节就可以任意切为独立 DOM 片段”。它没有证明所有分片方案都不可行，也没有测量巨大章节的容量或性能。需要验证的是拆分后仍成立的选择器、继承、计数器和布局上下文；表格、ruby、浮动及纵横排混排各有额外条件。选择器和计数器的相关规则分别见 [Selectors](https://www.w3.org/TR/selectors/#structural-pseudos)与 [CSS Lists](https://www.w3.org/TR/css-lists-3/#inheriting-counters)；本轮没有单独运行计数器用例。

## fonts.ready 完成与字体成功是两件事

本地服务器在字体请求后返回故意无效的字节。实际结果为：

- FontFaceSet.load 的 Promise 拒绝，FontFace.status 为 error。
- 同一轮 document.fonts.ready 仍正常完成。
- 之后加入并使用第二个字体时，旧 ready Promise 仍已完成，但新字体与 FontFaceSet 已进入 loading，并产生新的 ready Promise。
- 第二次字体加载同样失败，第二个 ready Promise 同样正常完成。

这与 [CSS Font Loading 的 ready 规则](https://drafts.csswg.org/css-font-loading/#font-face-set-ready)一致。读取几何前等待 ready 可以协调当次字体排版，但不能据此认定所选字体成功，也不能把旧 Promise 视为以后所有布局的完成凭据。字体结果、已采用回退及本次布局必须分别确认。

## 范围与复现

本轮只验证上述浏览器机制，没有实现 Reader、拆分算法、原文投影或导航提交，也没有运行跨浏览器矩阵。没有访问系统剪贴板。外部请求为零，renderer 无 Node 接入；字体请求限于本地服务器的两份合成响应。

试件复用既有运行时记录，输出包含 probe、runner 与运行时记录的 SHA-256。以仓库根目录执行：

```powershell
python -B refactor/verification/evidence/kana-layout-boundaries/run.py
```

阅读操作及资源寿命的正式要求见[公开接入](../../../design/projects/kana/api.md)。
