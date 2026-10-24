# Kana 呈现机制验证

2026-10-20，本轮为[呈现与交互机制](../../../design/projects/kana/layout.md)运行原生分栏、文字比例与局部 caret 试件。此前已确认的格式与输入方案另行采用，本页不重新执行或扩大那些验证。

## 两个实际运行时

使用隐藏窗口、关闭 renderer Node 接入，书内 iframe 仅授予 allow-same-origin。运行中外部请求为零；图像夹具是本机服务器提供的自有 SVG。没有创建正式 Reader，没有修改应用依赖或系统设置，也没有写入系统剪贴板。

| 运行时                                   | 来源                                                | 结果                                                           |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Electron 41.2.0／Chromium 146.0.7680.179 | 仓库当前已经安装的 Electron，记录包与可执行文件摘要 | [project-browser-contract.json](project-browser-contract.json) |
| Electron 44.5.1／Chromium 152.0.7977.130 | 此前已固定的隔离运行时                              | [browser-contract.json](browser-contract.json)                 |

两者执行同一 [probe.cjs](probe.cjs)，不视为两个独立排版实现。主规范与兼容资料的实际下载、日期和摘要见 [references.json](references.json)。没有安装新的浏览器或调整浏览器实验 flag。

## 分栏与源文字

五组基础配置对照普通横排、普通竖排、分栏换行的两种竖排及嵌套正交分栏。普通竖排第二栏的 y 增加，采用 column-height／column-wrap 后第二面沿 x 方向出现：vertical-rl 向左，vertical-lr 向右。样本中的位移为 300px，符合 280px 阅读面加 20px 间隔。嵌套配置只保留观察，没有据此提出另一条兼容后端。

随后使用 792 个自有日文字符，执行三种 writing-mode × 一／双面 × 20／28px，共 12 个配置。横排采用 nowrap，竖排采用 wrap，均形成物理横向片段带；iframe 的实际尺寸与当前一／双面区域相符。对每个源字符建立 Range，检查非零几何、按布局得到的页序不倒退、原文字未变，并实际沿正负 scrollLeft 抵达最后一面。每个运行时检查 9504 个字符位置。保存同一文字 offset 后重新布局，仍取得同一源字符，生成页号随字号变化。

另有横排和 vertical-rl 两个起始空槽位样本。通过视图偏移让第一份内容处于另一侧，再推进一个双面组，后两份源内容进入正确的左右位置；三个原有内容子节点保持不变，没有插入源占位节点。这只是槽位与片段带接续的机制验证，没有执行完整 EPUB 页位算法。

这组试件没有接入真实 EPUB、CFI 或 FB2 地址；其 offset 是受控文字节点中的位置。也没有完整验证 ruby、长表格、浮动、跨栏标题、作者 page 指令、混合轴连续交接或超大章节。它证明一份 DOM 能通过当前原生分栏机制形成左右竖排页面，不证明完整书籍分页已经实现。

规范依据是工作草案 [CSS Multicol Level 2](https://drafts.csswg.org/css-multicol-2/)，[Chromium 的功能发布说明](https://developer.chrome.com/blog/multicol-wrapping)说明 145 起支持相应属性。本次运行进一步核对了项目实际使用的 146；没有仅凭 CSS.supports 返回 true 判定布局成功。

## 字号比例

三组输入分别取正文根 14／14／16px、段落 14px、标题 2em、显式小字 10.5px 与 ruby 注音 50%，读者基准为 20／28／20px。先读取作者计算字号，再按根基准统一换算，每个元素只写一次。

正文根 14px 的样本变为段落 20／28px、标题 40／56px、注音 10／14px；原根 16px 而段落 14px 的样本变为段落 17.5px、标题 40px、注音 8.75px。后者明确显示“调整基准、保留局部比例”和“所有段落强制同值”的差别。固定 80 × 40px 图像仍保持该尺寸。

没有据此证明行距、独立背景与配色、全部字体替换、SVG 继承值、伪元素或作者 CSS 条件的处理。也没有测量大 DOM 的样式读取开销；比例快照在字体／视口／样式变化后的失效与重算属于仍需接入的责任。

## 局部 caret 与复制载荷

在横排、vertical-rl 与 vertical-lr 中，从相同起点调用原生 Selection.modify 逐字符前进。7 次结果均为 UTF-16 offset 1、3、4、5、7、8、9，受控 emoji 代理对与 e 加组合重音没有被拆开；下一行移动也到达真实后续文字，源内容不变。

这只验证局部原生移动可作为输入机制的组成部分，没有执行完整阅读器的物理按键映射、真实指针跨 iframe 拖选、触控或辅助技术测试。先前的真实跨文档鼠标机制仍见[阅读路线验证](../kana/reading-route.md)，不能把两组局部通过合并为完整选择实现通过。

实际创建 Promise 型 ClipboardItem，再通过 getType 取得完整的 text/plain Blob；两个运行时均成功。没有调用 navigator.clipboard.write，因此权限、焦点、用户激活寿命和系统复制成功都未验证。API 存在及载荷构造成功不等于真实复制链路成功。

## 复现与限制

```powershell
python -B refactor/verification/evidence/kana-presentation/prepare.py
python -B refactor/verification/evidence/kana-presentation/run.py --project-runtime
python -B refactor/verification/evidence/kana-presentation/run.py
```

脚本、运行时和引用资料分别保留摘要。重新准备输入时核对固定摘要；正式浏览器范围见[版本规则](../../../design/projects/kana/README.md#browser-versions)，本页不证明完整范围均已运行。
