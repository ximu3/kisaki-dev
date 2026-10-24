# 作者断页、内部补白与完整分页器对照

2026-10-20，针对此前 Firefox 强制换栏缺口继续验证。原生与补白输入来自 [probe.mjs](probe.mjs)，由 [run.cjs](run.cjs) 在 Chromium 149.0.7827.55、Firefox 153.0 和 Windows WebKit 26.5 测试构建中运行，结果见 [browser-contract.json](browser-contract.json)。这些版本是本次机制环境，不替代当前维护窗口或真实 Safari／WebKitGTK 的验收。

## 语法接受与实际断页分别观察

每个引擎分别在横排、vertical-rl、vertical-lr 下运行九种声明，共 81 组原生布局观察。每份文档包含两个 60px 块向尺寸的内容块，阅读面为 280×400px，使用单栏、20px 栏间隔与 column-fill:auto。通过目标矩形判断是否进入下一片段，不以解析成功作为断页成功。

| 声明                                 | 本次实际结果                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| break-before:column                  | Chromium／WebKit 换到下一片段；Firefox 不接受该值，仍在当前片段                        |
| -webkit-column-break-before:always   | Chromium／WebKit 的本次前缀写法映射到 column；Firefox 未接受                           |
| break-before:page、page-break-before | page／旧 always 可以解析，但在本次普通分栏中不强制进入下一片段                         |
| break-before:always                  | Firefox 语法接受且计算值保留 always，但没有发生目标换栏；另两个构建不接受该值          |
| break-before:all                     | 本次三个构建都不接受该值                                                               |
| break-before:left／right             | 本次分栏中没有产生目标换栏；它们不能只凭语法接受就当成已经实现左右阅读面               |
| column-span:all                      | 有自身的跨栏行为，但没有实现本试件要求的“剩余当前面留空，后续内容从下一完整阅读面开始” |

page 与 column 对应不同片段化语境，见 [CSS Fragmentation 的强制断点](https://www.w3.org/TR/css-break-3/#forced-breaks)。这组试件不证明支持值在其他语境无效，也没有把解析器与布局缺口混成同一个问题。Mozilla 的 [549114](https://bugzilla.mozilla.org/show_bug.cgi?id=549114) 仍记录相关未实现部分。

## 源节点保持不等于断页语义保持

内部补白试件给现有 flow 元素建立手动分配的 ShadowRoot，将两个原有源节点分配到两个 slot，在它们之间放入只属于布局的空盒。源节点没有移入新父节点，也没有把补白盒插到原来的兄弟序列中。

每个引擎对三种书写模式分别测试 0／20px 的目标块起始边距，共 18 组。所有组都将目标放入下一原生片段，源文字 AB、原有两个子节点、兄弟选择器、红色及粗体结果保持。伪元素计数器的占位宽度也保持；本轮没有直接读取完整生成计数器值，不将宽度一致扩大为计数器符合性通过。

补白没有保留所有断点条件。Chromium 原生强制换栏时保留目标前 20px 边距，改用本次补白后目标贴到新片段的 0px 处；横排与两种竖排均如此。WebKit 本次边缘几何也与 Chromium 不同，其数据完整保存在记录中。辅助空盒使用零字号、零行高及明确尺寸，仍不能把自然溢出产生的断点直接视为原来的强制断点。

另检查实际 ShadowRoot 宿主限制：三个引擎均允许 div、section，而对 ul、ol、li、table、tbody、tr、td 抛出 NotSupportedError。这只证明该直接挂载方法不能原样应用到这些元素，不证明列表或表格断页在原则上无解。

本轮未实现一般断点解析、余量测量、原边距恢复、并行／嵌套排版或真实字体重排。补白尺寸根据自建夹具明确给定，没有把这段试件包装成完整分页算法。

## 完整分页器的受控比较

通过[准备脚本](prepare-layout.py)取得固定的 @vivliostyle/core 2.45.2，校验 npm 的 SHA-512 完整性，并记录 bundle、准备脚本与同一提交的上游许可摘要，见 [layout-input.json](layout-input.json)。制品位于工作区忽略缓存，没有执行包安装脚本或改变工作区依赖。该 npm 制品未附完整 LICENSE，准备过程另外保存了同提交的上游许可文件，没有将两者混写。

[layout-engine.cjs](layout-engine.cjs)通过公开 CoreViewer 接口传入一份已解析的自建 XHTML Document，设置 renderAllPages:true 与 allowScripts:false。文档包含 A、B 两块，B 明确 break-before:page，并要求 20px 块起始间距；三个引擎分别执行三种书写模式。结果见 [layout-contract.json](layout-contract.json)。

| 书写模式      | 本轮三个引擎的观察                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| horizontal-tb | 两块进入不同页面；B 位于 x=0、y=20，尺寸 280×60，与夹具预期相符                                        |
| vertical-rl   | 两块进入不同页面；B 位于 x=200、y=0，尺寸 60×400，即右侧留出 20px，与夹具预期相符                      |
| vertical-lr   | 两块进入不同页面，但 B 位于 x=0、y=20，尺寸约 20×60；未得到预期 x=20、y=0、60×400 的逻辑尺寸与间距结果 |

最后一组的计算 writing-mode 的确为 vertical-lr。因此不能把“值正确”或“已经生成两页”当成完整呈现通过；结论限于本次逻辑尺寸和间距用例，不概括为该库全部 vertical-lr 内容都不能显示。九组中六组匹配本次完整几何预期，三组未匹配。

该库给传入文档增加了 data-adapt-eloff、data-viv-display-none 等内部属性，正文 AB 与两个正文子节点的次序保持。本轮确认的是输入对象会被注记，不是源正文损坏。正式接入若采用它，不能把需要保持只读的格式事实直接当作任意可变排版输入。

本轮没有执行 Kana 源地址往返、选区、高亮、语义文档身份、辅助技术、懒分页预算、取消或公开 close 的完整接入。每个用例通过关闭自己创建的浏览器 page 释放实验窗口，不能据此宣称已经满足 Kana 的资源寿命合同。没有采用该库，也没有修改项目许可；实际采用需另外核对[上游许可](https://github.com/vivliostyle/vivliostyle.js#license)。

## 复现与限制

```powershell
node refactor/verification/evidence/kana-breaks/run.cjs
python -B refactor/verification/evidence/kana-breaks/prepare-layout.py
node refactor/verification/evidence/kana-breaks/layout-engine.cjs
```

原生测试的运行时与[既有浏览器记录](../kana-browser-scope/source-input.json)对应；脚本与输入摘要各自写入结果。所有测试使用独立配置目录与本机夹具服务，外部页面请求为零，没有系统剪贴板写入、系统设置修改或真实出版物上传。浏览器上下文和本机服务均在 finally 中关闭。

这些记录证明具体的成功、差异和反例，不证明所有可能的补齐方案都不可行，也不把成熟分页器的一次短调用当成整库选型完成。[作者断页规则与责任](../../../design/projects/kana/layout.md)仍区分产品保证、技术路线与验证是否完成。

后续另核对并直接运行了 [Foliate 的作者断页路径](foliate.md)：外部 CSS 被转换为换栏属性后仍依赖原生分栏，本次 Firefox 场景未得到强制断页；内嵌样式也未经过相同的断页替换。该结果没有被当作自动降低 Kana 目标或采用上游实现的决定。

进一步的[浮动辅助断页试件](float.md)检查了作者间距、实际排版上下文、多个断点及字号／尺寸重排；其中同时保留普通块流的正向结果与列表、表格等反例，仍不构成完整 Firefox 适配通过。
