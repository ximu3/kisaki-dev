# 样式转换与共享状态的组合核对

2026-10-20。本轮沿用已有字体、配色、CSS 输入、源地址和焦点证据，只新增一个组合场景，回答覆盖优先级、反复更新、图形继承、多投影状态和原生空白求值的衔接问题。没有扩展三引擎矩阵，也没有运行正式 Reader。

[probe.mjs](probe.mjs) 包含自有短内容、显式指定的试件角色和两个显示文档。[run.cjs](run.cjs) 使用已固定的 Chromium 149.0.7827.55 与 Playwright 1.62.1，复用 css-tree 3.2.1 和此前生成的 AuthorFixture／ReaderFixture 微型字体。输入校验和实际结果见 [browser-contract.json](browser-contract.json)。

## 观察结果

| 组合问题                          | 实际结果                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 行内 important 与伪元素 important | 原文 20px、before 10px 在正文基准从 16px 调到 24px 后分别为 30px、15px；原 style 属性选择器仍匹配，attr(style) 仍读到作者原值 |
| 反复调整字号                      | 第二次基准为 20px 时得到 25px、12.5px，未在第一轮结果上再乘；源 Text 对象和 Range 原文仍保持                                  |
| 私用字形伪元素                    | 保留 AuthorFixture 字族；字号随普通文字比例成为 30px、25px，没有把“保留字族”误当作固定字号                                    |
| 图形的根单位与注册属性            | HTML 根仍为 16px，图形保留 16px 字号、原颜色及 `--measure:32px`；混用注册属性和 rem 的宽度保持 64px                           |
| 渐变图文范围                      | 原渐变声明及文字颜色保持，没有用一个 RGB 背板替换该渐变                                                                       |
| 两文档的 focus 样式               | 直接使用各自原生 focus 时，间距为 19px 和 0px；按源状态投影后均为 19px，实际焦点仍只在语义文档                                |
| 可读资格的基本反例                | visibility:hidden 父元素下的 visible 子元素仍可见；display:contents 父元素没有盒，但子内容有盒                                |

私有读者层在 namespace 之前预声明，作者层顺序继续由浏览器处理；源 style 的读取通过属性投影保留。这个场景没有专用资源 URI 的 style 改写，故试件的作者原值与未叠加读者覆盖的展示基线相同；正式转换仍按[两者的实际含义](../../../design/projects/kana/styles.md#overrides)保存和恢复。

原生空白容器只包含必要文字、语言与 white-space 设置，text-transform 为 none，不调用 Selection。观察为：

| 输入                                  | 输出                               |
| ------------------------------------- | ---------------------------------- |
| normal 的 `Straße \n B`，分在两个片段 | `Straße B`                         |
| zh、normal 的 `你\n好`，分在两个片段  | `你 好`                            |
| pre-wrap 的 `A  B\n C`                | 原样保留                           |
| normal 与 pre-wrap 相邻               | 保留本场景中适用的连续空格和硬换行 |

这些输出只说明本次浏览器的空白行为，尤其不把“中文源换行必定删除”写成库规则。非空白字符保持原样，原有焦点没有被求值容器移动。CSS Text 允许部分段落源换行处理由浏览器决定；HTML 的原生文字收集也明确区分 white-space 和 text-transform，见 [CSS Text](https://www.w3.org/TR/css-text-3/#line-break-transform)与 [HTML innerText](https://html.spec.whatwg.org/multipage/dom.html#the-innertext-idl-attribute)。

## 设计采用与证据范围

本轮将以上机制与已有反例统一到[样式转换](../../../design/projects/kana/styles.md#conversion)、[覆盖写入](../../../design/projects/kana/styles.md#overrides)和[共享交互样式状态](../../../design/projects/kana/interaction.md#style-state)。输入角色在试件中明确指定，没有实现自动角色分类、所有伪类投影、一般复合背景分析、完整空白来源映射或动画同步。

字体与私用区、颜色成对覆盖、SVG 继承和逻辑段距继续复用[此前三引擎证据](../kana-styling/styling.md)；层叠、属性、命名空间与变量 URL 继续复用 [CSS 输入对照](../kana-css-input/css.md)；真实焦点与多面节点寿命沿用[焦点机制](../kana-focus/focus.md)。这轮保留的是实际 DOM 文字身份，没有重新执行 EPUB CFI 或 MOBI 字节地址试件。

本场景未覆盖完整样式适配、全部支持浏览器、自动范围识别、复杂出版物、辅助技术或性能；这些范围按[阅读验收](../../scenarios/reading.md)核对。

```text
node refactor/verification/evidence/kana-style-conversion/run.cjs
```

运行器只提供有限的本机试件路由，外部请求和页面错误均为零；结束移除文档并关闭浏览器与服务。没有访问系统剪贴板、用户书籍或系统字体配置。
