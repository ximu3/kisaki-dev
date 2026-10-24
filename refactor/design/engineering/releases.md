# 版本、发行与说明更正

每个发行单位通过版本 PR 提交版本号、依赖变化和符合自身语言要求的说明。版本 PR 合并后，发行流程根据固定输入构建、验证并发布制品。私有测试阶段只生成受限制品，不发布到公共 npm、GitHub Releases 或 Pages。

<a id="versions"></a>

## 发行单位与版本

桌面、八个公共包和各官方扩展独立管理版本，desktop-contracts、extension-api 和 rpc 也分别发行。四个独立技术项目使用自己的版本和 Actions。公开 API 兼容范围与包版本分别表达，不通过 Nx、Changesets 或提交类型自动推导 SemVer。

package.json.version 是当前项目版本的唯一来源。扩展通过 package.json 中的 kisaki 元信息生成 manifest；桌面项目 @kisaki3/desktop 保持 private，扩展项目也不因存在 package.json 就发布到 npm。

<a id="release-identity"></a>

### 发行身份与标签

kisaki 表示产品与仓库，桌面发行名为 desktop。每个发行单位拥有仓库内唯一、稳定的发行名，使用小写 kebab-case。Node 项目从 package.json.name 去掉可选作用域后取得该名称，不另存一份手写别名；npm 发布仍使用完整包名。根工程、目录分类和内部工具不形成发行单位。

Git 标签使用 `<发行名>@<完整 SemVer>`，保留预发布标识与 build metadata，不添加 v 或 npm 作用域。说明地址复用同一个完整 tag，见[静态说明](#metadata)。

| 发行单位  | 项目包名               | 发行名        | Git tag 示例        |
| --------- | ---------------------- | ------------- | ------------------- |
| 桌面应用  | @kisaki3/desktop       | desktop       | desktop@0.1.0       |
| 扩展 SDK  | @kisaki3/extension-sdk | extension-sdk | extension-sdk@0.1.0 |
| 扩展 CLI  | @kisaki3/extension-cli | extension-cli | extension-cli@0.1.0 |
| UI 包     | @kisaki3/ui            | ui            | ui@0.2.0            |
| VNDB 扩展 | @kisaki3/ext-vndb      | ext-vndb      | ext-vndb@0.1.0      |

官方扩展的[ext- 前缀](../extensions/catalog.md#organization)属于项目包名，去掉作用域后原样保留为发行名；tag 生成不再次添加前缀。产品中的扩展 ID 继续由 manifest 独立定义。CI 检查全部发行项目的名称格式与唯一性，并核对官方扩展的命名前缀；不同项目去掉作用域后重名时拒绝发行，不自动拼接目录或后缀。目录移动不改变发行名，已经使用的发行名不得转交另一项目。

工具链中的各包独立发行，没有工具链共同版本。普通 PR 不要求额外变化描述文件，feat 或 fix 提交也不会自动升版。未来 Web、服务端和官网按实际交付方式确定各自的发行或部署单位。

发行清单根据版本 PR 中实际 manifest 的版本差生成，依赖关系来自 manifest 和锁文件，不维护第二份手写清单。维护者或明确受托的 agent 判断哪些变化需要交付给依赖者，不能机械升级所有包；需要交付给桌面用户的变化则必须通过桌面新版本发行。

CI 检查最低依赖范围、pack 后依赖和版本可取得性，但不能代替语义兼容判断。首次发行由未公开 dev 版本显式改为首个发布版本；新项目通过新增 manifest 识别，根初始提交没有对应版本 PR 时不自动首发。已被平台使用的版本不得因重建仓库而复用，起点见 [版本规则](repository.md#npm-history)。

<a id="version-pr"></a>

## 版本 PR

版本 PR 同时提交本批项目的 SemVer、必要依赖变化、从属平台包或 Cargo 版本、锁文件，以及各项目该版本的[必需说明和所提供译文](#notes)。涉及兼容范围、六目标制品、扩展包或迁移的影响也在该 PR 中说明。

维护者通过 release PR 标记表达发行意图，实际发行项目仍由版本差确定，不从标题中的另一份名单推导。修改版本必须使用版本 PR，而版本 PR 必须包含实际交付变化；仅更正已有发行说明时使用元数据流程。

CI 执行普通检查和发行资料检查，并生成可审阅的项目、版本、渠道、依赖和制品汇总。自动化不写入版本号，也不维护长期滚动的机器人版本 PR。

私有测试和公开初始化条件满足后，版本 PR 合并即触发自动交付，不再要求第二次发布确认。流程入口检查真实仓库可见性和目标配置；准备成功不能被报告为已经公开发行。

<a id="publish"></a>

## 发行来源、顺序与并发

release.yml 在 main push 后精确查找对应的已合并版本 PR、release 标记和最终版本差。Squash 父提交作为本批基线，发行来源固定为合并后的最终 SHA。普通 push 不因为存在未发布版本而自动补发；维护分支使用同样明确、受保护的流程。手动重试继续采用既有发行来源，不能取当前 main 重新构建旧版本。

准备阶段只读取固定 SHA 及其依赖，各目标可以并行构建、签名和验证。每个项目的依赖闭包和全部必要目标就绪后才对外发布。公开依赖先变得可取得，桌面和扩展随后发布；.kisx 和展示资源已经公开可读并验证后，才能签署和部署索引。

GitHub Release 草稿先收齐全部附件。桌面只有在六目标制品和更新元数据齐全后才能公开，并采用 [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases) 保持 tag 与 asset 不变；标题和说明可以按更正规则修改。

写入 npm dist-tag、公开 GitHub Release 和部署静态资料共用一个 Actions concurrency 组，使用 queue: max，不能取消正在发布的任务。检查与构建仍可并行。按 [GitHub 并发规则](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)，队列最多容纳 100 个等待项，入队顺序不代表 Git 或版本顺序，默认单 pending 行为也不能提供顺序保证。超出容量或执行失败时明确报告，并从同一来源重试，不另建常驻队列服务。

进入发布临界区后重新检查平台状态。同版本已存在时，只有来源和字节一致才视为已完成，否则失败。npm 先使用明确的临时 tag 发布，再按项目和渠道比较已发布版本，更新 latest、beta 或 rc，最后移除临时 tag，避免旧构建晚完成后使渠道倒退。GitHub Latest 显式指向适当的稳定桌面版本，作为人工浏览入口；自动更新不依赖该标记，其他包族也不能覆盖它。

GitHub、npm 和 Pages 之间没有共同事务。部分发布成功时保留实际结果，停止尚不满足依赖的后续步骤。同源重试只补齐缺失内容，继续使用固定提交、版本和已验证文件。通过 CI 留存或平台恢复制品时检查字节一致；无法取回原文件则停止，不能重新构建不同内容冒充原发行。

普通 CI 使用只读权限，签名与发布按最小权限执行。秘密不进入日志、源码、发行说明或 fixture。常规 npm 发布使用 OIDC，首次建包按 [短期 token 流程](repository.md#npm-publishing) 完成后撤销凭据，不默认建立 GitHub App 维护版本 PR。

<a id="prereleases"></a>

## 预发行与维护分支

各项目独立使用 SemVer 稳定、beta 或 rc 版本。桌面 beta、稳定扩展和 UI rc 可以同时存在。转为稳定版需要新的版本 PR；预发行阶段按项目需要选择。

稳定版说明描述相对上一稳定版的最终变化，不堆叠所有测试版说明。npm 明确使用 latest、beta、rc 或维护 tag，预发布版本不能覆盖稳定 latest。GitHub prerelease 与 SemVer 阶段一致，registry 从实际扩展包读取阶段；第三方标识仍保持开放。

应用和每个扩展分别保存 allowPrerelease，默认 false。更新只选择更高且兼容的版本，关闭预发行不会自动降级。临时 CI 制品以 SHA 标识，不作为正式更新来源。

确有同时维护需求时，才从稳定 tag 建立维护分支，不预建长期 develop、beta 或 rc 分支。跨项目联合交付先完成独立上游的新发行，再由 Kisaki 正式消费。

<a id="notes"></a>

## 发行说明与语言

说明语言按发行单位的消费者确定，稳定版、beta 与 rc 使用同一要求：

| 发行单位 | 必需语言 | 可选译文 |
| --- | --- | --- |
| 桌面应用、全部官方扩展 | en、zh-Hans、zh-Hant、ja | 可增加其他语言 |
| 八个公共技术包、四个独立技术项目 | en | 根据实际消费者提供其他语言，不要求每次发行均有三份额外翻译 |

必需语言缺失时不能发行。提供的译文都须与英语基准保持事实一致，允许自然的语序和表达差异；可选语言缺席时沿 LocalizedText 回退，不生成空文件或机器翻译占位。项目归属决定要求，不从当前存在的说明文件数反推；技术包的英语基准不改变桌面与扩展的 UI 本地化范围。

说明源文件跟随独立发行单位，放在实际版本声明所在项目的 release-notes 下。目录分类与 Git 同仓不产生共同版本，clients 或 desktop 分类目录不拥有一份合并发行说明。

| 发行单位     | 源文件位置                                                     |
| ------------ | -------------------------------------------------------------- |
| 桌面应用     | clients/desktop/app/release-notes/                             |
| 桌面公共包   | clients/desktop/packages/<package>/release-notes/              |
| 官方扩展     | clients/desktop/extensions/projects/<extension>/release-notes/ |
| 独立技术项目 | 各自仓库内实际发行项目的 release-notes/                        |

未来 Web 应用和服务端在明确发行方式后，按各自实际发行单位保存说明。官网普通文案和排版变更通过提交与 PR 记录；需要面向用户说明的独立功能发行另按官网自身的发行合同处理，不将其他项目的说明源文件移入 site。

桌面与官方扩展的目录示例如下；技术项目至少包含 en.md，其余语言只在提供对应译文时存在。

```text
<project>/release-notes/
└── 0.1.0-beta.2/
    ├── en.md
    ├── zh-Hans.md
    ├── zh-Hant.md
    └── ja.md
```

目录名使用完整 SemVer，不加 v。历史说明目录表达已发行身份，不成为当前项目版本的第二来源。Markdown 文件只保存正文，不含 frontmatter，也不通过固定 H1 重复项目名、版本或日期。项目不同时维护汇总 CHANGELOG；是否随包携带说明由打包 allowlist 决定，不默认将全部历史说明装入桌面或 .kisx。

说明面向消费者，描述可观察的变化、修复、兼容影响和必要操作，按内容分组，不强制固定章节或词语前缀。CI 检查所属项目的必需语言、所有已提供文件的非空内容、语言标签、版本关联、链接和占位内容；维护者或受托 agent 审校语义与译文。

官方说明的 defaultLocale 为 en，官方扩展 manifest 与之保持一致。生成 release 时仍读取该版本实际 manifest，工具不能暗中修改。第三方可以使用其他默认语言、普通字符串或不提供说明；kisx 接受作者准备的正文，不强制作者采用本仓库的目录和工具。

<a id="metadata"></a>

## 说明生成与静态部署

| 消费位置       | 生成物与读取职责                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| GitHub Release | 从已提供的 Markdown 生成 body；多语时提供语言入口和分区，只有英语时直接呈现正文，供人浏览；程序不解析标题或 HTML 折叠标记恢复语言            |
| dist 静态说明  | 为 Kisaki monorepo 的各发行项目生成独立 JSON，包含 project、version、defaultLocale 和 LocalizedText releaseNotes |
| 桌面发行说明   | updates 读取 desktop 对应的静态 JSON，界面按有效 UI 语言选择正文                                                 |
| 官方扩展注册表 | 同一来源直接写入对应 release 的内联 LocalizedText，再由 kisx 校验和签名；客户端读取索引即取得正文                |

dist 的说明覆盖桌面应用、八个公共包和官方扩展，公共包包含 SDK、CLI 等作者工具。它们分别使用自己的发行名和版本。四个独立技术项目由各自仓库交付说明，不因被 Kisaki 消费而并入该部署；未来同仓工程在建立实际发行单位后沿用同一规则。

官网启用更新日志页面后，读取已经发表的正式说明数据进行呈现，不另外维护桌面、公共包或扩展的手写副本。源文件存在不代表该版本已经发布。根目录可以提供导航或生成汇总，说明更正始终从实际发行项目的源文件开始。

各项目的说明源文件和 registry 配置保存在 main。GitHub Actions 从这些源文件生成完整 Pages artifact，再通过 upload-pages-artifact 和 deploy-pages 直接部署。生成内容由构建产物和部署记录管理。

kisaki.me 是产品主入口，dist.kisaki.me 提供静态说明和索引。安装包、.kisx 和大型归档放在 Releases，公开库放在 npm，地址见 [公开入口](repository.md#application)。静态分发独立部署，各服务按实际需要选择部署平台；Web 产品范围遵守产品与仓库合同。

说明 URL 统一为 `https://dist.kisaki.me/release-notes/<完整 tag>.json`。发行名和版本分别通过校验后拼成一个路径段，保留 tag 中的 @、点、连字符和加号；地址不包含 npm 作用域、额外平台目录或语言后缀。

```text
/release-notes/desktop@0.1.0.json
/release-notes/desktop@0.2.0-beta.1.json
/release-notes/extension-sdk@0.1.0.json
/release-notes/extension-cli@0.1.0.json
/release-notes/ext-vndb@0.1.0.json
```

每份 JSON 的 project 使用发行名，version 使用完整 SemVer，两者必须与地址及实际发布一致；defaultLocale 为 en，releaseNotes 是包含英语及全部已提供译文的 LocalizedText 对象。桌面和官方扩展仍须包含四种必需语言，技术包可以只有 en。文件不承担安装地址、平台或更新渠道选择。桌面只接受 project 为 desktop 的说明，公共包和官方扩展各自校验对应身份。

实际版本目录中的 Markdown 是唯一说明来源。GitHub body、静态 JSON 和适用的扩展索引保留同一组语言与正文，不补造缺席译文；扩展客户端继续直接消费签名索引的内联说明。registry/index.json 仍在同一文件内保存签名。

可更正的说明 JSON 统一从 Pages 读取，Release 附件保留不可变制品。Pages job 按 [官方 workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)取得所需 pages:write、id-token:write 以及分支、环境权限。版本 PR 合并后自动完成部署。

说明按不可信 Markdown 限制呈现，不能执行脚本或触发更新。正文暂不可读不阻止有效更新的发现与准备，界面可以重试或打开 releaseUrl。缓存按完整 tag 和 HTTP 校验管理；说明可以更正，版本不变不表示正文永久不变。

元数据由唯一部署流程负责，发行和更正共用发布临界区。初次说明固定在发行 SHA；后续更正读取 main 中已经审阅的同项目、同版本内容，维护分支的说明先同步到编辑位置。每次部署固定内容 SHA，未公开版本不能因为源文件已存在就上线，二进制继续对应原发行 SHA。

临界区以最后一次成功的完整快照和验签通过的 registry 作为已发表基线。新增版本通过 kisx 从实际 .kisx 追加，更正只修改目标正文；保留版本、首次 publishedAt、哈希和被引用资源，不能根据当前源码项目列表删除历史。首次部署显式初始化，移除版本或修改仓库资料须通过明确维护操作。

部署前组合最新说明、完整索引和仍被引用的资源，验证后作为同一快照发布，避免旧构建晚到覆盖新内容。部署记录来源并回读验证。各版本说明和签名索引须自包含，以容纳缓存延迟及多个 HTTP 地址切换时间的差异。

首次发行按所属语言要求完成投影验证，再发布不可变制品、部署说明与适用的签名索引。部分内容已公开时按真实结果报告，从同一来源补齐。正文选择遵守 [LocalizedText](../ui/localization.md#localized-text)；切换 UI 语言只选择已有文本，不重新选择安装目标或机器翻译，也不要求该语言的 UI 译本已经安装。

<a id="corrections"></a>

## 已发表说明的更正

通过普通 PR 修改原版本的说明源文件。metadata.yml 检查该版本已发行、必需语言齐全及所提供译文有效，再生成对应 GitHub body 和静态 JSON；涉及扩展时同步 release 内联说明并重新签署索引。更正只改变正文，不改发行名、版本号、首次 publishedAt、tag、说明 URL 或制品哈希，也不重新上传同版本二进制。

更正进入共同发布临界区后，读取最新审阅内容。某个出口失败时记录已经完成的部分并允许重试；如果原修订已经被新修订替代，重试采用新的内容 SHA 并记录原因，不能使在线说明倒退。制品重试则始终使用固定字节，两者规则不同。

说明源文件是更正依据，不能从线上正文反推，也不能只在 GitHub 网页手动修改。事实变化同步到全部仍提供的语言；不再维护的可选译文须在 PR 中明确移除，之后按英语基准回退，必需语言不能移除。维护者负责版本、依赖、兼容信息和说明内容，自动化负责检查、构建、生成、签名、上传和回读验证。
