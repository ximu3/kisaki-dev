# 作者 CSS 输入、地址与原属性读取对照

2026-10-20，检查保留原生层叠时的 CSS 输入与资源处理。使用固定 css-tree 3.2.1，来源、包完整性及许可摘要见 [source-input.json](source-input.json)，准备过程见 [prepare.py](prepare.py)。解析器仅放在忽略缓存，没有改变工作区依赖。

[fixtures.mjs](fixtures.mjs)提供自建 HTML／XHTML、CSS 和 SVG 资源；[rewrite.mjs](rewrite.mjs)实现范围明确的语法转换；[run.cjs](run.cjs)执行浏览器比较。完整输出见 [browser-contract.json](browser-contract.json)。

## 四条输入路径

| 路径      | 处理方式                                                                   |
| --------- | -------------------------------------------------------------------------- |
| source    | 原文、原属性和原样式直接使用原来的受控地址                                 |
| naive     | 将需要改写的地址变成内部地址，保留其余 CSS 匹配方式                        |
| projected | 在地址转换之外，保留相关原属性值，并将属性选择器和受查 attr 读取对应到原值 |
| scoped    | 只改变受控资源地址空间的入口，保留目录关系；作者 CSS 和正文属性均不改写    |

三种测试引擎分别使用 HTML／XHTML、横排／vertical-rl／vertical-lr、340px／640px 两种视口宽度。每个组合比较四条路径，共 36 组、144 份文档。矩阵覆盖的是同一套受控语义，不代表完整出版物兼容性。

最终 36 组均取得预期结果：原值投影与保留目录关系两条路径在受查值和资源目标上保持原文结果，单独改写地址的路径保留为反例。

## 层叠与来源关系

输入同时包含外部样式表、嵌套 @import、style 元素和 style 属性。导入保留 layer、supports 与 media 条件；嵌套文件故意以不同延迟返回，检查实际样式结果不依赖网络完成顺序。

受查值包括颜色、字号、行高、逻辑内边距、边框、链接装饰、SVG 填色与透明度。base 层中的 important 声明在本次场景中仍按原生规则胜出，宽窄视口分别取得 19px／22px 的作者字号。

命名空间 URI、条件中的语法检查与普通字符串没有被当成资源读取。例如 @namespace 中的 SVG URI 保持名称空间身份；字符串里的 url(...) 和 page-break 字样保持原样。资源引用中的 CSS 转义由语法解析器处理。

## 改写地址会改变 CSS 对属性的读取

naive 路径改变了 src、href、style 或命名空间 href 的实际值。只改地址会使匹配原值的选择器失效，并改变 attr(href) 的生成内容。受查边框、图片轮廓、链接装饰和 SVG 属性匹配因此产生差异。

projected 路径给相关作者属性保留独立的展示原值，再把对应 CSS 属性读取映射到它们。原值与实际展示地址各自表达不同含义；它们不成为新的资源授权或格式源位置。

本次覆盖普通属性、xlink 命名空间属性，以及命名空间通配匹配。通配展开使用原生 :is 组合保留属性选择器的权重。试件仅登记无命名空间与 xlink 两类，使用已知不会冲突的试件前缀；正式的完整命名空间收集、名字避碰和全部选择器语法没有在本轮完成。

Firefox 的计算样式会将受查生成内容序列化为 attr(...)，其他测试构建返回展开后的字符串。因此，记录保留各自序列化形式，但比较实际链接的宽度与高度，并同时核对匹配原值的链接样式；没有将这两种 CSSOM 表示误判为显示内容不同。

## 自定义属性中的相对 URL 需要原生解释

最初把变量定义中的 URL 一律提前绝对化，实际改变了加载目标。修正后保留原生变量语义，并保持文档和样式表的逻辑地址关系：

| 受控输入                                                                   | 实际请求对应的逻辑资源 |
| -------------------------------------------------------------------------- | ---------------------- |
| shared/base.css 中定义未注册变量 url(paper.svg)，在 styles/main.css 中使用 | book/styles/paper.svg  |
| 同一个未注册变量改在行内样式使用                                           | book/paper.svg         |
| main.css 中定义注册为 URL 类型的变量 ../art/inline.svg，再在行内样式使用   | book/art/inline.svg    |

上述差异符合 [CSS Variables 的晚绑定 URL](https://www.w3.org/TR/css-variables-1/#defining-variables)与[注册属性的计算值规则](https://www.w3.org/TR/css-properties-values-api-1/#computed-value-time)。不能按变量名只保存一个提前解析的图片目标，也不能把相对地址全按定义文件固定。

scoped 路径保留实际目录关系，原样式表和原正文属性可以不改动；浏览器仍在适用位置解析相对引用。projected 路径中的未注册变量也依赖这一逻辑地址关系，没有声称单靠属性投影就能解决所有 URL 基准问题。

## 最终核对的范围

完整运行逐组核对：

- projected 与 source 的受查样式值、资源目标集合、生成内容尺寸、正文文字和 id 次序一致。
- scoped 除上述结果外，正文元素的属性名、命名空间与属性值也和 source 一致。
- naive 保留文字，但受查样式读取出现差异。
- 普通变量与注册变量实际指向预期的不同资源；没有读取命名空间 URI、语法检查 URL 或普通字符串中看似地址的文字。
- 固定定位的独立控制元素用于验证视口单位；分栏中的元素另保留原生使用值，不把某个片段里的使用尺寸直接当作固定视口大小。

本轮没有执行完整 HTML 转换、正式格式地址往返、读者字号／配色覆盖、CSS 断页适配、Blob 资源图、真实辅助技术或完整 Reader。没有宣称未知 CSS 语法、所有命名空间、全部动态状态或实际宿主传输已经兼容。

## 复现与环境

```powershell
python -B refactor/verification/evidence/kana-css-input/prepare.py
node refactor/verification/evidence/kana-css-input/run.cjs
```

复用[既有浏览器机制环境](../kana-browser-scope/source-input.json)，运行前核对可执行文件摘要：Chromium 149.0.7827.55、Firefox 153.0、Windows WebKit 26.5。没有运行真实 Safari 或 WebKitGTK。

文档 CSP 限制同源资源，原文与映射资源均由本次本机服务按固定资源表交付；最终页面外部请求为零。四条互不依赖的路径并行观察，导航有单次期限，浏览器上下文与服务有明确收尾。早先的过早变量解析、CSSOM 表示比较和运行期限问题用于修正试件，不作为最终机制失败的结论。

受控 HTTP 目录映射仅验证本页的资源与 CSS 观察；正式作者样式处理及资源承载方式见[样式规则](../../../design/projects/kana/styles.md)。
