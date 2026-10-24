# 分栏方向、填充和字号覆盖的浏览器对照

2026-10-19，在隐藏的 Electron 44.5.1／Chromium 152 文档中运行七个合成内容文档，核对三个排版判断。输入由 [probe.cjs](probe.cjs) 直接生成；结果见 [browser-contract.json](browser-contract.json)，四份规范的快照指纹与锚点检查见 [references.json](references.json)。这不是完整 Reader 或真实出版物的分页验证。

## 两栏不直接等于左右双页

两个文档使用相同的 600×400 CSS px 容器、两栏、20px 栏间距和强制换栏，仅改变 writing-mode：

| writing-mode  | 第一个内容块位置 | 第二个内容块位置 | 实际排列 |
| ------------- | ---------------- | ---------------- | -------- |
| horizontal-tb | x=0，y=0         | x=310，y=0       | 左右     |
| vertical-rl   | x=580，y=0       | x=580，y=210     | 上下     |

这与 [CSS Multi-column](https://www.w3.org/TR/css-multicol-1/#the-multi-column-model)按 inline 方向组织栏的规则一致。它说明需要区分产品中的双页和底层分栏坐标；没有证明完整竖排分页、物理页面排列或跨页命中已经成立。

## 栏填充影响末屏组织

另两个 400×160 CSS px 文档放入六个高度为 20px 的文字块。balance 占用两栏，auto 只占用第一栏。两种布局的原始文字与顺序相同，差别来自填充策略。

该结果用于讨论是否将章节末屏的文字平衡到两面。它没有覆盖孤行／寡行、表格、图片、跨章分页或浏览器差异。规范另见 [column-fill](https://www.w3.org/TR/css-multicol-1/#cf)。

## 根字号与逐元素覆盖都需要额外判断

三份同源内容分别不覆盖字号、只覆盖根字号、覆盖所有元素：

| 处理                | 正文 | 标题 | ruby 注音 |
| ------------------- | ---- | ---- | --------- |
| 原始样式            | 14px | 32px | 8px       |
| 根字号改为 24px     | 14px | 48px | 12px      |
| 每个元素都设为 24px | 24px | 24px | 24px      |

正文有自己的明确字号，所以只改父级字号没有替换它；逐元素同值又抹平了结构层次。相关值取得规则见 [CSS Cascading and Inheritance](https://www.w3.org/TR/css-cascade-5/#inheriting)。本轮只验证反例，没有实现或证明新的字体比例转换、全部作者样式覆盖和自动可访问性修正。

## 范围与复现

窗口隐藏运行，renderer 无 Node 接入，外部请求为零，没有使用外部字体、用户文档或系统剪贴板。记录包含 probe、runner 与既有运行时记录的 SHA-256。七份文档分别对应两种方向、两种填充和三种字号处理，不是七本不同出版物。

从仓库根目录执行：

```powershell
python -B refactor/verification/evidence/kana-layout-policy/run.py
```

本页观察不覆盖源位置往返、完整字体处理、阅读操作或多浏览器兼容；正式要求见[布局规则](../../../design/projects/kana/layout.md)。
