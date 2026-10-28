# 扩展终态与一致性审查

审查日期：2026-10-28。基线：`ad9113d0c9eb0d83ee32e876a2aa8cab35fdbffe`。范围为 42 篇扩展设计、33 项工程的配置与说明，以及分发目录 README；逐项结论见 [extensions-coverage.json](extensions-coverage.json)。

## 结果与修订

已逐篇核对全部扩展设计及每项工程的 package.json、tsconfig.json、eslint.config.ts、kisx.config.ts 和 README，并核对 33 项许可证一致性。共同语义同时对照 architecture、communication、metadata/metadata-contracts、records、relations、library 查询/操作、i18n、onboarding 和工程合同。未改变公开 API、模型、来源映射、支持范围、认证模式或缓存策略。

25 篇设计做了语义不变的职责、证据归属或文字一致性修正；17 篇保留。33 项 README 统一说明实际工程配置与正式设计/交付入口，registry README 说明分发资料归属。未删除已确认工程，未创建业务入口或宣称可安装制品。

- 开发工具正文直接说明 CLI 拥有创建工作流，并将“逐项设计”链接从实施状态改到官方目录。
- 认证总表补齐已在专门设计定义的 itch.io 与 MangaUpdates；Google Desktop/OpenID、AniList relay 与 TMDB 用户授权继续沿既有合同。
- 原型大小、测试操作、临时回调、清理经过和待补样本移回已有证据引用。设计保留可执行规则与必要理由。
- MAL 末段原称“completed 与进度分别写入所选字段”，与该篇“不提供分部/累计进度同步”冲突。现按本篇既定范围说明作品状态、评分和完成日期，来源进度只记录原生联动。
- 保留真实的运行阶段、临时资源、权限/格式约束、未知结果和失败。来源对象映射、原配采用约定、书籍版本粒度、各导入器的页序/位置和计时语义均有各自依据，未为形式统一改写。

## 语言扩展稳定身份

正式设计 [languages.md:11–13](../../../../design/extensions/languages.md) 固定 `kisaki.language.zh-hans`、`kisaki.language.zh-hant`、`kisaki.language.ja`；2026-10-17 的 [projects.json](../../language-extensions/fixtures/projects.json) 与 [验证结果](../../language-extensions/2026-10-17-verification.json)使用同一身份。

[localization.md:5](../../../../design/ui/localization.md)以语言设计为具体身份权威，:33 的 UiTranslationRef 使用完整 extensionId；[onboarding.md:52](../../../../design/domains/onboarding.md)的推荐也引用正式 extensionId。catalog/distribution 将包名、展示名和产品 ID 分开，点分身份本身合法。

审阅时三份工程 package.json:9 使用 `kisaki.language-zh-hans`、`kisaki.language-zh-hant`、`kisaki.language-ja`。其余相同错值仅见 W00 及综合审查历史清单，历史记录应保持原事实。主代理已确认按正式设计纠正清单，不增加兼容别名。

未发现发布/持久化消费者依据：三个项目均为 `0.1.0-dev.0`、`private: true`，只有工程配置，无 src、apiVersionRange 或 build/pack 脚本；registry 只有 README，无安装索引。[实施状态原记录](../../../../implementation/status.md)明确 33 项仅有身份与配置，[W09 清单](../../../../implementation/delivery-checklist.md#extensions)的实现、正式宿主、安装消费均未开始。本次未通过网络查询推定旧项目发行身份，旧项目 API/格式不属于当前兼容范围。

## 移出正文后继续保留的事实与缺口

以下均为原有证据或基线文档记录，本轮没有重新执行来源授权、读写、真实软件导出或平台制品验证。

| 事项 | 保留事实与证据范围 |
| --- | --- |
| Google OAuth 应用验证 | 基线 googlebooks.md:85 原文为“本次使用的自有 OAuth 应用尚未通过 Google 的应用验证”。该段没有独立事实日期；同页引用的来源核验日期为 2026-10-16，不能据此补写应用审核日期。book-sources/live-api.md 记录 Desktop 交换/刷新、OpenID 身份与书架 API 成功，未单独证明应用验证完成。主代理应在本轮正式证据与状态保留“应用验证未取得完成证据”。正文仅保留发行条件。 |
| Google Desktop 与书目样本 | client ID 单独交换失败，桌面配置补齐后成功；books-only 无稳定账号标识，openid/email 校验成功；Series 完整分页及独立书架操作仅覆盖原有样本。[来源记录](../../book-sources/live-api.md)保持原数据。 |
| AniList 授权与高级评分 | 来源核验采用临时本机保密客户端，回调已经恢复；刷新成功不等于正式 relay 交付。高级多维评分没有启用，实际重算/回读未取得运行证据；不因模式关闭已确认入口。[来源记录:18–36、84、127](../../anime-platforms/live-api.md)。 |
| AniList 原生联动 | 正文中的测试动作表移回来源依据，五条正式写入规则完整保留。开始/完成日期、已知总量进度、REPEATING 完成时 repeat、未知总量样本及喜爱读回滞后均仍在同一来源记录中；不将未选字段补写作为正式路径。 |
| Playnite NativeAOT | 2026-10-17 来源核验仅取得 Windows x64 的受限读取路径结果，原生程序为 4,891,648 字节，真实备份与 22 项合成检查通过；其余五个目标及正式扩展未完成。LiteDB 4.1.4 对象映射漏洞与 IL3050 警告按受限 API 范围审计，不概括为整个库安全/AOT 完整支持。[原记录](../../playnite-importer/live-backup.md)。 |
| Vnite | 真实备份与合成夹具分别验证非空库、获胜修订、启动形态、区间、回忆/图片，以及状态、评分、累计矛盾等；这不替代正式 ingest、UI、取消及平台制品。[原记录](../../vnite-importer/live-backup.md)。 |
| PotatoVN 及其他合成格式 | PotatoVN 未取得真实用户导出；calibre、Mihon、NFO/ComicInfo、LaunchBox、Koodo、Anx、KOReader、Kotatsu、YACReader 的格式/样本证据均按各自原记录区分固定源码、合成输入与真实软件结果，不能将本轮审查记为完成实际导入。[证据索引](../../extensions.md)。 |
| LaunchBox | 2026-10-17 核验没有真实 Data/备份。PlaySessions JSONL 的完整行格式、版本键及总量覆盖关系和新版存档管理未确认，原合同已明确不提供相应迁入；本轮保持这一范围，没有将合成标记当正式历史。[原记录](../../launchbox-importer/source-and-fixtures.md)。 |
| itch.io | 原核验已撤销测试授权；本人公开合集 20 项只证明枚举，未逐项证明均为游戏；另有 30+11 项分页与末尾 404 样本。正式权限、分类与分页结束规则保持。[原记录](../../reference-sources/live-api.md#itch)。 |
| TMDB | 游客评分、本人与应用令牌范围、v4/v3 身份、真实私密列表和测试列表创建行为分别限于已测范围。默认分发凭据仍须验证可读范围，不能将 api_read 名称当公开只读保证。[来源记录](../../tmdb/account-api.md)。 |

全部被改写或移出的正文可通过本次提交与记录的基线比较复核；原始证据文件没有修改。

## 工程与验证范围

33 项工程的配置源码按注释剥离后逐项核对：相同 Node 类型基线、仅工程配置的 include、两个实际检查脚本、7 项实际工具依赖、正式包名/独立 ID 与 kisx 的构建输入声明。包依赖已排序，33 项 LICENSE 只有一种字节内容。5 项目标为 Node-only，28 项设计包含 Webview；当前全部仍是配置工程，W09 实现需要其实际源码/构建输入，这不是删除已确认工程的理由。

本次完成：

- 76 份 Markdown 的 617 个本地文件/锚点引用检查通过，见 [验证记录](extensions-verification.json)。
- 34 份扩展 README 的定向 Prettier 检查通过；仅格式化这些 README，未运行全仓格式。
- 本范围 `git diff --check` 通过。
- 33 项配置结构、依赖一致性及源码输入现状检查通过，详情见 [配置清单](extensions-project-configs.json)。

未执行长测试、业务/真实宿主、打包、六目标、来源联网或发布验证；文字修订不构成 W09 完成。没有提交、推送、创建 PR 或新增聊天。

## 汇总闭合

三个语言工程的产品 ID 已由主审按正式点分身份修正；Google 应用验证缺口已列入当前实施状态。
