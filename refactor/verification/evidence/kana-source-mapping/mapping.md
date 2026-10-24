# HTML 词法来源与修复映射补证

2026-10-20，本轮补充[既有 MOBI／KF8 源映射](../kana-formats/format-sources.md)，验证 HTML 的文字回放、元素复制、合并与省略如何保留源地址。沿用已固定的 parse5 8.0.1、entities 8.0.0 及 UTF-8／Windows-1252 源解释；没有改动旧试件、其结果或正式项目代码。

这是一组源映射机制验证，不代表固定 KF8、完整 CFI、全部 HTML 符合性、正文可见性或整个 Reader 已完成。

## 新发现与处理

[baseline.mjs](baseline.mjs) 对上一版明确标为不完整的试件运行 36 组自有输入。其中 13 组暴露了未覆盖的词法回放或外来内容转换；记录见 [baseline-contract.json](baseline-contract.json)。这些失败属于旧研究试件，不是已发布 Kana 的回归。

[markup.mjs](markup.mjs) 保持 parse5 的词法和树构建算法，通过同一版本的内部事件接缝记录来源：

- 标签似的输入重新按文字输出时，按实际词法状态记录其原始字符区间。多个字面字符分别保留起点，字符引用展开的多个字符则共同指向该引用。
- CRLF 的源字节、零宽边界、实体展开和 UTF-16 端点分别保留；编码字符或字符引用内部、半个代理对不能成为合法文字起点。
- `createElement` 接收的原始属性数组联系其开始标签。格式元素重建和 adoption agency 复制仍可指向同一源标签；合并属性的后续标签也保留其真实对应。自动补出的元素没有虚构源地址。
- 文字插入和搬移沿 treeAdapter 的实际操作记录。修复后的一个 Text 可以来自多个不相邻源区间，源范围也可以对应多个显示片段。
- 外来内容中的 NUL 替换按已经发生的 HTML 规则保留来源。被舍弃的节点和文字没有可呈现对应时返回 `locationUnavailable`，不会近似绑定到别的节点。

元素与文字来源来自词法事件及树构建过程。试件中的 `sourceCodeLocationInfo` 用于完整标签起点等语法事实，没有重新用最终文字在原始标记中反向搜索。

## 实际结果

| 检查                               | 结果                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| Node 24.11.1，36 组 × 4 种输入分块 | 144 次解析，源对应保持一致；修复树与未修改的 parse5 相同 |
| 保存、换分块重新解析、恢复端点     | 2,420 次通过                                             |
| 编码字符和字符引用内部字节         | 372 次明确拒绝                                           |
| Chromium 149.0.7827.55             | 903 次实际 DOM Range／注入包装／Text 拆分检查通过        |
| Firefox 153.0                      | 903 次同类检查通过                                       |
| Windows Playwright WebKit 26.5     | 903 次同类检查通过                                       |

Node 的端点比较包含重新创建解析结果；浏览器检查将同一源节点拆成宽度为 1、3、11 个 UTF-16 单元的 Text，并插入包装元素，核对真实 Range 文字与源地址。宽度 1 会拆开代理对，持久端点仍只允许完整字符边界。它验证来源绑定不依赖展示子节点编号，不是屏幕布局或用户拖选的测试。

原始 HTML 再交给浏览器解析时，三个引擎都与固定 parse5 在 36 组中的 35 组相同；`select-filtering` 有一致的差异：浏览器保留 option 内的 div，parse5 8.0.1 省去这个标签、保留其文字。完整差异树保存在 [browser-contract.json](browser-contract.json)，没有把它计作“原生树全部相同”。

这个反例说明，正式呈现须从格式已有的解释结果建立并绑定 DOM。不能将其序列化后交给当前浏览器重新解析，再假定仍是同一棵树。资源地址与 CSS 加载仍沿既有方案；这里确定的是源结构与展示节点的对应，不是改换资源传输路线。

浏览器均隐藏运行，使用既有固定[引擎输入](../kana-browser-scope/source-input.json)。每个环境的页面错误和外部请求均为零，运行结束后浏览器、上下文及本机服务已关闭。WebKit 试验不是 Safari 或 WebKitGTK 的实机验收。

## 证据与复现

[node-contract.json](node-contract.json) 和 [browser-contract.json](browser-contract.json) 记录精确脚本、解析器束、编码表和浏览器输入摘要。[cases.mjs](cases.mjs) 是全部自有 HTML 输入；[browser.mjs](browser.mjs) 是 DOM 绑定对照。复用已有缓存，从仓库根目录执行：

```powershell
node refactor/verification/evidence/kana-source-mapping/baseline.mjs
node refactor/verification/evidence/kana-source-mapping/run-node.mjs
node refactor/verification/evidence/kana-source-mapping/run-browser.cjs
```

浏览器脚本同时运行[XML 编码对照](../kana-xml-codecs/codecs.md)，需先准备和构建该试件。原始第三方输入仍由此前的 [html-input.json](../kana-formats/html-input.json) 固定，没有新增生产依赖或改写锁文件。

本试件未覆盖完整 publication、真实格式与展示绑定、阅读路径中的原文和搜索、样式可见性、大书索引及连续选择；完整接入见[格式与输入](../../../design/projects/kana/formats.md)及[阅读验收](../../scenarios/reading.md)。
