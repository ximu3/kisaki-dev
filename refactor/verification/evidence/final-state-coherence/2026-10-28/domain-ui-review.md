# 领域与 UI 终态一致性审查

基线：`ad9113d0c9eb0d83ee32e876a2aa8cab35fdbffe`；分支：`review/final-state-coherence`。

已全文审阅 domains 45 篇、ui 8 篇，共 53 篇，并核对 product、architecture、communication 与新核心准则。逐篇结论见 [coverage](domain-ui-coverage.json)。本轮修改 24 篇，均限于授权目录；用户确认后补齐音量/静音持久合同及扫描换行范围。其余修改保持既定语义，没有改写历史验证材料、来源预设优先序或 UI 保留目标。

## 已闭合的表述与一致性问题

- 领域/UI 导航入口引用首要终态与整体一致性准则。
- 扫描、记录、更新、阅读格式、预设与验证说明直接表达当前行为，移除“原行为”“移除某来源”“新旧过渡”“验收前”等实施叙述；现有证据链接与验证要求保留。
- 小说作品首选与卷首选分别明确落在 novel_files、novel_file_volumes。
- ingest 的 graph.ts 产物明确为本地写入图，与 metadata 候选图区分。
- 主题基线摘要与 appearance 的名称/token/完整分支比较单位统一；游戏偏好与实际字段目录统一。
- 应用菜单纳入已约定的未保存记录处理入口，不决定常显或条件显示；引导按共同反馈归属承担一次提示。
- 笔记保留完整私人内容、显式保存、附件、冷备份和不提供选择性导出的边界，删除无对应现行展示合同的泛化承诺。

真实失败、权限边界、业务阶段、准备句柄、待保存快照、恢复材料及闭集支持范围均按正式语义保留，未作关键词删除。七篇资料预设的全部字段和关系表已逐篇核对。

## F1：应用级音量/静音的持久拥有者已确认并闭合

位置：[anime.md:213](../../../../design/domains/anime.md#preferences)、[sessions.md:311](../../../../design/domains/sessions.md#playback-controls)、[sessions.md:319](../../../../design/domains/sessions.md#playback-setting-result) 与 [preferences 完整字段目录](../../../../design/domains/preferences.md#fields)。

审查时合同承诺记住上次音量/静音，setVolume/setMuted 交付已持久保存的事实，saved.scope 使用 application；但未定义相应存储、初始值、音量值域和保存拥有者。“由相应模块保存”不足以确定依赖方向和首次打开行为。

可选方向：

1. 由 preferences 管理独立于完整播放配置的应用级控制记忆，沿其现有保存能力接入；需要补充明确字段、值域与初始值，并确认其是否属于偏好 UI。
2. 设单独的持久运行偏好拥有者；能与普通偏好分开，但增加概念、读取和生命周期协作。

用户确认采用 preferences 的独立 playback 配置组：volumePercent 初始 100、范围为 0–100 的有限百分比，muted 初始 false。已同步 preferences 存储/默认/宽容读取与逐字段保存，sessions 的初始化/即时保存/当前执行者采用，anime、UI 控件与工程接入。新文件读取正式记忆，同文件复用保留状态，其他已打开实例不联动；完整播放配置不包含这两项。不新增偏好页入口、搜索字段或保存协议。现有运行源码未出现对应正式能力，本轮未声称完成播放器实现。

## F2：九项扫描预设的 Unicode 换行边界已确认并闭合

共同正则/整串约束见 [scanner.md:268](../../../../design/domains/scanner.md#rule-values)；预设文字位于 scanner.md:335。九项表达式位于以下行：bracket-both 343、multi-bracket-prefix 346、release-year-suffix 349、version-suffix 352、lang-suffix 355、bracket-prefix 358、paren-prefix 361、bracket-suffix 364、paren-suffix 367。审查时它们的文字或块字符类主要使用 `[^\r\n]`。

文件识别通过 [file-recognition.md:59](../../../../design/domains/file-recognition.md#recognition-rules) 和 [file-recognition.md:197](../../../../design/domains/file-recognition.md#recognition-output)复用正则与模板机制；[file-recognition-presets.md](../../../../design/domains/file-recognition-presets.md#definitions) 的标题、双编号与路径表达式（71、94、117、162、207、230、259 行）显式排除 U+2028/U+2029。

小探针直接读取九项文档表达式，使用 ECMAScript u/适用 i 和完整字符串约束。Node v24.11.1 下，修订前九项正常样例均命中，名称中插入 CR/LF 均不命中、U+2028/U+2029 均命中，原结果保存在 [before](scanner-line-separator-probe.before.json)。脚本：[scanner-line-separator-probe.ts](scanner-line-separator-probe.ts.txt)，修订后完整输出：[scanner-line-separator-probe.json](scanner-line-separator-probe.json)。

用户确认九项扫描预设统一拒绝 CR/LF/U+2028/U+2029，自定义规则仍按表达式解释。已同步九项表达式、说明、验收范围与文件识别预设的共同边界。修订后九项正常样例通过，在各样例每个插入位置放入任一行终止符均不命中；明确允许全部字符的自定义表达式仍接纳四者。探针通过，不代表扫描、Worker、文件系统或 UI 集成验收。

## 验证与跨目录事项

`git diff --check -- refactor/design/domains refactor/design/ui` 通过；覆盖 JSON 与实际 53 篇清单、24 篇修改清单一致，新增引用锚点有效。未运行全仓格式化或长测试。所有改动已逐段回读，没有变更锚点。外部参考资料仅保留为既有依据，没有冒充本轮新核验。

工程追加审查见 [engineering-review](engineering-review.md)。主代理统一处理 RAR/CBR 与 Kana 格式合同、正式新证据归档及实施状态；F1/F2 的领域、UI 与工程接入合同已闭合。

