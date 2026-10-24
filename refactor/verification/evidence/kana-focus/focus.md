# 多面展示的语义文档与焦点验证

2026-10-20，使用[已准备并记录的浏览器构建](../kana-browser-scope/source-input.json)运行 [probe.mjs](probe.mjs) 与 [run.cjs](run.cjs)。运行时为 Chromium 149.0.7827.55、Firefox 153.0、Windows WebKit 测试构建 26.5；每个引擎执行横排、vertical-rl、vertical-lr，共九组受控场景。详细数据、代码指纹及未覆盖项见 [browser-contract.json](browser-contract.json)。这些构建说明本轮机制验证的环境，不充当当前稳定版本名单或维护窗口的完整验收记录。

试件每次建立两个完整、同源的短章节展示文档。第一份保留语义入口，第二份 iframe 使用 aria-hidden 与负 tabindex；正文内容未为去重而切碎或替换。宿主代码管理输入，内容 CSP 禁止书内代码执行。源位置使用自建文本索引，未实现 EPUB CFI、MOBI 字节地址或 FB2 格式映射。

## 禁用副本会影响实际命中

同一个可见点分别在 aria-hidden 显示副本与增加 inert 的副本中读取原生命中：

| 机制                 | Chromium   | Firefox  | WebKit 测试构建 |
| -------------------- | ---------- | -------- | --------------- |
| aria-hidden 元素命中 | 源元素     | 源元素   | 源元素          |
| aria-hidden 文字命中 | 源偏移     | 源偏移   | 源偏移          |
| inert 元素命中       | 无源元素   | 无源元素 | 无源元素        |
| inert 文字命中       | 仍有源偏移 | 无源偏移 | 仍有源偏移      |

元素命中使用 elementFromPoint，文字命中使用 caretPositionFromPoint 并核对是否属于源文字索引。该结果说明这里不能依赖 inert 保留跨引擎的完整命中能力；不据此推断所有 inert 行为必须在三个引擎中相同。机制含义见 [HTML 的 inert 子树](https://html.spec.whatwg.org/multipage/interaction.html#inert-subtrees)。

## 真实输入与同一个语义文档

九组场景分别执行以下过程：

1. 将第二个源链接放到显示副本上，用浏览器自动化发送真实指针点击。输入对应回源目标，先进入语义 iframe，再聚焦对应链接；显示位置随之调整。
2. 将字号从 20px 改为 26px，重新定位。语义 Document 与实际聚焦元素均保持同一对象，链接目标仍在可见阅读面中。
3. 在两个相邻片段之间正向和反向拖选。原生命中在受控字符边缘允许一个字符的 caret 边界差异；逻辑固定端／活动端与语义文档中的原生选择一致，显示副本没有第二份选择。
4. 用 Tab 遍历三个源链接并离开到宿主按钮，再用 Shift+Tab 反向返回。显示副本没有进入遍历，焦点目标均位于可见面。
5. 用键盘到达第二个链接并按 Enter，记录一次对应源激活。

这些输入由 page.mouse 与 page.keyboard 发送，没有用 dispatchEvent 冒充用户输入。结果中的指针与激活事件为 trusted，副本中的元素 focusin 次数为零，正文内容保持相同。只核对目标几何可见，未执行焦点轮廓的像素或对比度验收。

试件中的焦点项是三个已知普通链接，Tab 协调没有实现任意内容的可聚焦性解析。正文通用焦点项、从当前源位置就近进入、输入框、组合控件、触控与复杂双向文字均不在通过范围内。

## 原生默认遍历与激活差异

同时记录关闭试件 Tab 协调后的原生行为。Chromium 与 Firefox 在本次构建中可依次到达三个链接；WebKit 测试构建跳过链接直接进入后面的宿主按钮。启用内容范围内的协调后，九组场景均按同一顺序完成前后遍历，并能正常离开阅读区。

这不是 Safari 的实测结果。Safari 的 Tab 与 Option-Tab 还受其键盘设置影响，见 [Apple 的快捷键说明](https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac)。正式接入仍须在实际端口和用户设置下验证，不修改用户的全局键盘设置来使试件通过。

Firefox 本次构建的 Enter 激活产生 click.detail 为 1、pointerType 为空的 trusted click。只接受 detail 为零会漏掉它。最终试件只去重已经处理过的具体指针序列，其余原生链接激活进入共同源动作；没有将辅助技术点击等同于某个 click.detail 值。该判断来自本次事件记录，不声称执行过真实屏幕阅读器激活。

## 原生无障碍树检查

仅在 Chromium 使用 CDP Accessibility 读取原生树，并在同一个持续启用的会话中比较换面、字号重排前后的结果：

- 顶层暴露的章节 iframe 只有语义文档一个，显示副本的入口未被暴露。
- 语义文档保留一个标题和三个链接，名称及节点 id 保持。
- 直接指定隐藏子 frame 查询，仍可读取其内部标题与链接节点。入口排除不表示浏览器内部没有为该文档保存另一棵树。

因此，本项支持“一份对外可访问入口与稳定语义节点”的机制判断。它不等于 NVDA、VoiceOver、Orca 的实际朗读、虚拟游标、跨章接续或关闭重开已通过；Firefox 与 WebKit 也未取得同等原生树证据。

[WAI-ARIA](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden)要求隐藏冗余内容时仍保留等价含义和功能；[顺序焦点检查规则](https://www.w3.org/WAI/standards-guidelines/act/rules/6cfa84/)另核对隐藏内容不会进入顺序焦点导航。它们解释本试件的机制分工，不构成本项目完整符合性声明。

## 修正与复现

探索时发现三处试件问题并修正：把 body 也设为 overflow:hidden 会截断根的分栏滚动范围；简化源索引在相邻文本节点边界处取前一节点，会把链接起点误映射到前一片段；跨文档只直接 focus 链接在 Firefox 的部分场景未采用目标，最终先聚焦实际语义 iframe 再聚焦其链接。链接点击与文字选择也分别处理，不在普通点击时强行投影一个文字选区。

上述问题按各自拥有者修正后重新执行全部九组场景。受控源索引的修正只证明该试件的边界选择，不能代替真实格式地址的节点语义或 CFI side bias。

从仓库根目录执行：

```powershell
node refactor/verification/evidence/kana-focus/run.cjs
```

运行器复用既有测试浏览器并核对可执行文件摘要，配置目录仅位于 node_modules/.cache/kana-focus。页面只访问本次本地夹具入口，外部请求为零，没有系统剪贴板写入或安装辅助技术。每个浏览器上下文均在 finally 中关闭，本次修改不涉及用户浏览器配置或系统键盘设置。

记录明确标明真实屏幕阅读器、Safari、WebKitGTK 和格式源映射均未执行。后续已经确认[语义文档与焦点机制](../../../design/projects/kana/interaction.md)，这里的证据仍限于本轮局部场景；完整生命周期与实际辅助技术接入仍须完成。
