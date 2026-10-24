# 字体、配色与段落边界验证

2026-10-20，复用[已记录的三个浏览器测试构建](../kana-browser-scope/source-input.json)，在隔离配置目录中运行同一组自建内容。Chromium 为 149.0.7827.55，Firefox 为 153.0，Windows WebKit 测试构建为 26.5。三者均通过本页列出的观察断言；不是实际 Safari 或 WebKitGTK，也不是完整 Kana Reader。

输入为 [probe.mjs](probe.mjs) 的短 HTML 和 [prepare.py](prepare.py) 生成的三份原创微型字体。字体只用少量矩形字形表达可识别的宽度差异，不来自用户字体或真实出版物。[run.cjs](run.cjs) 执行并校验结果，[browser-contract.json](browser-contract.json) 保存每个引擎的八组样式观察、三种方向的段距观察、输入指纹及限制。

## 字体后备不能保护同码位的不同私用字形

字号固定为 20px：

| 处理                                         | 普通 A 宽度 | 私用区 U+E000 宽度 |
| -------------------------------------------- | ----------- | ------------------ |
| 作者字体                                     | 14px        | 20px               |
| 所选字体优先，后备仍含作者字体               | 9px         | 6px                |
| 普通文字采用所选字体，私用字形恢复作者字体链 | 9px         | 20px               |
| 所选字体不含该私用字形，作者字体作为后备     | 9px         | 20px               |

三个引擎的结果相同。第二行的所选字体也包含 U+E000，因此浏览器不会因其字形与作者不同而继续后备。测试验证的是实际字体选择和几何；字符的业务含义不是根据宽度推断的。

[CSS Fonts 的字体匹配规则](https://www.w3.org/TR/css-fonts-4/#font-matching-algorithm)规定按字体链匹配，并对私用区使用明确命名字体。试件支持保留书内字形来源的必要性，没有实现任意真实格式的私用字符发现、伪元素分析或字素簇映射。

## 根颜色与单侧覆盖的反例

原始正文为 #222，文档底色为白；目标阅读前景为 #eee，背景为 #111：

| 处理                            | 观察结果                                               |
| ------------------------------- | ------------------------------------------------------ |
| 只修改根前景和背景              | 段落已有的 #222 保留，与新背景的对比度约 1.19:1        |
| 普通文字全改为 #eee，保留原色块 | 白底提示框变为浅字白底，对比度约 1.16:1                |
| 提示框前景与背景成对覆盖        | 对比度约 16.28:1；同轮覆盖也消除了原书红字与正文的区别 |

这些对比度只针对夹具中的不透明 sRGB 色对计算，用于明确展示冲突，不是全部配色、文字大小或无障碍合规结论。没有对复合背景、透明混合、背景图片和渐变建立自动对比度算法。

原书配色与指定阅读颜色各有明确用途。该观察支持[已确认的配色选择](../../../design/projects/kana/styles.md#colors)，不自动证明任意颜色转换可以同时保留作者信息和可读性。

## 排除 SVG 选择器仍会改变其继承值

自建 SVG 使用 currentColor 绘图，其文字继承外层字号。只把根字号从 16px 改为 24px、根颜色从 #222 改为 #eee，图形也随之改变，尽管没有直接选中 SVG 子元素。

在图形边界保留试件实际依赖的作者继承值，以及原先承托图形的白色画布后，三个引擎均保留 16px 图形文字、#222 绘图颜色和白色背景，外层正文仍可独立调整。这里的夹具只有一层不透明根背景。这证明需要处理继承与背景关系，没有证明一份固定属性清单覆盖全部 SVG、MathML、自定义属性或复杂图文。

CSS 对 SVG 与外部颜色关系也有专门处理，见 [CSS Color Adjustment](https://www.w3.org/TR/css-color-adjust-1/#forced-color-adjust-prop)。本试验没有启用或修改系统强制颜色设置。

## 行高与逻辑段距

三个引擎对试件中的 line-height:normal 均返回 normal；不能仅靠该字符串得出一个固定的原始倍率。对普通段落明确采用 24px 字号与无单位 1.8 行高后，计算行高为约 43.2px；标题自己的行高、ruby 的局部规则和斜体仍保留。该观察没有同时执行此前完整的字号比例算法。

另在 horizontal-tb、vertical-rl 和 vertical-lr 中，对两段自建内容采用 margin-block-end:18px、margin-block-start:0，实际沿各自块方向的段间距离均为 18px。没有将其推定为任意嵌套块、分页边界或 margin 折叠场景已经通过。

行高的数值、normal 与继承含义见 [CSS Inline Layout](https://www.w3.org/TR/css-inline-3/#line-height-property)。正文与特殊结构的分工可参考 [Readium 的用户设置建议](https://readium.org/css/docs/CSS14-user_settings_recs.html)，具体覆盖规则仍由 Kana 判断。

## 环境、输入与复现

从仓库根目录执行：

```powershell
python -B refactor/verification/evidence/kana-styling/prepare.py
node refactor/verification/evidence/kana-styling/run.cjs
```

字体生成使用已安装的 fontTools 4.60.1；字体、生成记录和浏览器配置保存在 node_modules/.cache/kana-styling。未安装字体、改写工作区依赖或浏览器设置。三个测试进程均在 finally 中关闭，内容文档移除后撤销本轮字体 Blob URL。

内容脚本被 CSP 禁止，测试控制代码由宿主页运行；字体先由宿主从本次本地夹具入口取得，再以受控 Blob 交付内容文档。最初直接使用 srcdoc 的 font-src 'self' 在 Firefox 中受到策略阻止，最终记录采用上述受控 Blob 路径，并同时满足宿主与内容策略；没有放开任意网络来源。

所有观察保留相同的正文文字和元素结构，外部页面请求为零，没有系统剪贴板写入。源文字与结构一致不代表 CFI、MOBI 字节地址或 FB2 节点往返已实现；试件明确记录 sourceMappingImplemented:false 和 fullPublicationTested:false。

本轮没有运行私用区嵌入真实复杂字体、伪元素字形、完整读者样式、跨面选区或辅助技术。后续已确认样式范围并更新公开合同；设计确认不改变本轮试件实际覆盖的范围。
