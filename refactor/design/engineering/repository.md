# 仓库、公开身份与协作

Kisaki 和四个独立技术项目分别使用项目级临时私有仓库完成正式发布前的开发、联调和验证，再接续各自的正式仓库与发行。仓库重建前保存源码、平台资料和有价值的本地内容，新历史从可运行的工程基线开始。GitHub 仓库、npm 包、应用身份和部署地址各自维护，不因其中一项重建而自动重置其他记录。

<a id="identity"></a>

## 仓库与包的归属

五个项目的 GitHub 所有者统一为 ximu3，本地仓库直接位于 F:/project 下。kisaki 是统一产品仓库，按 clients/desktop、clients/web、site 和候选 server 区分工程归属，具体布局见[仓库与公开边界](layout.md#workspace)。当前交付仍限于桌面生态与已确定的独立技术项目。官方扩展源码和 registry 纳入 clients/desktop/extensions，各扩展仍独立打包。源码位置、分发目录、Git 身份和 npm 作用域分别说明各自用途。

| 最终仓库                   | 目标本地目录           | 重建来源                              | 实施动作                                                                                                                 |
| -------------------------- | ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ximu3/kisaki               | F:\project\kisaki      | 已有公开仓库                          | 完成旧资料存档后同名重建；当前桌面生态在 clients/desktop 下按 monorepo 组织                                              |
| ximu3/vantage              | F:\project\vantage     | 原 ximu3/process-list 仓库与 npm 发行 | 按[原生库定位](../projects/vantage/api.md#surface)完整重写并以新名称建仓；公开包为 @ximu3/vantage，既有 npm 发布记录保留 |
| ximu3/kana                 | F:\project\kana        | 新独立项目                            | 新建阅读内核仓库，不虚构需要重置的旧 Git 历史                                                                            |
| ximu3/libmpv-node          | F:\project\libmpv-node | 已确定的新独立项目                    | 新建 libmpv Node 原生绑定仓库，平台二进制与主包按项目自身版本交付                                                        |
| ximu3/oauth-relay          | F:\project\oauth-relay | 已有运行服务，采用新实现              | 直接新写并建立独立私有仓库；切换前核对现有接入和部署事实，不以旧源码为前置，不把服务器凭据带入源码                       |
| 原 ximu3/kisaki-extensions | 不建立独立新仓库       | 已有独立源码及发行记录                | 将扩展源码与分发资料纳入 Kisaki monorepo；完成存档与新分发入口核对后撤下旧独立仓库，实际撤下范围纳入重建操作             |

F:/project/3/kisaki 和 F:/project/3/process-list 保留到存档验证完成。创建目标工程前检查目录是否已被占用，不覆盖或自动清理来源目录。Kana 和 libmpv-node 新建独立仓库；oauth-relay 使用独立工程，并在服务切换前核对域名、回调地址、应用配置和当前部署状态。

| 包或范围                  | npm 发布名                                                                                              | 归属依据                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Vantage 原生库            | @ximu3/vantage                                                                                          | 独立的进程与窗口观察、控制和窗口画面采集能力，Kisaki 通过公开包接入                            |
| Kana 阅读内核             | @ximu3/kana                                                                                             | 独立的阅读内核，Kisaki 通过公开包接入                                                          |
| libmpv-node 原生绑定      | @ximu3/libmpv-node                                                                                      | 独立的 libmpv Node 绑定与可选受管渲染，Kisaki 是消费方                                         |
| Kisaki 桌面外观与 UI      | @kisaki3/appearance、@kisaki3/ui                                                                        | 表达桌面与扩展界面的视觉体系和组件合同                                                         |
| Kisaki 桌面共同合同       | @kisaki3/desktop-contracts                                                                              | 桌面本体与扩展共同使用的能力合同                                                               |
| Kisaki 扩展运行与作者生态 | @kisaki3/extension-api、@kisaki3/extension-distribution、@kisaki3/extension-sdk、@kisaki3/extension-cli | 运行规范、分发格式、运行接入和作者工作流；真实名称与迁移按 [npm 版本与退役](#npm-history) 核对 |
| Kisaki 桌面通信机制       | @kisaki3/rpc                                                                                            | 桌面与 SDK 共用的环境无关消息式内核；不因通用机制另立项目，发布前核对实际控制权                |

Kisaki monorepo 的 Node／TypeScript 应用、公共包和官方扩展项目统一使用 @kisaki3 作用域，包括不向 npm 发布的项目。作用域表达项目归属，使包名在依赖、构建日志和项目列表中能够独立辨认。桌面项目包名为 @kisaki3/desktop，官方扩展采用[ext- 命名前缀](../extensions/catalog.md#organization)；Vantage 及其平台包使用独立的 @ximu3 作用域。

npm 发布资格单独配置：桌面、官方扩展和根工程等不向 npm 发布的项目设置 private: true，需要公开发布的 scoped 包明确设置 public。Git tag 使用仓库内的[发行名](releases.md#release-identity)，从项目包名去掉作用域后生成；桌面发行名为 desktop。说明 URL 复用完整 tag，不另存手写别名。

同一 scope 下的包分别拥有自己的仓库、版本与公开用途。发布前必须核对实际控制权和名称可用性；查询未被占用不代表已经取得该名称，规则见 [npm scope](https://docs.npmjs.com/about-scopes/)。

<a id="temporary-repositories"></a>

## 正式发布前的临时仓库

临时私有仓库是一个项目从工程建立到正式公开前的持续开发远端，承载正常提交、PR、CI、跨平台验证、候选制品和跨仓联调，不限于 W00 或任何单次验证。工作包完成只改变对应实施状态，不结束临时仓库的用途，也不为下一工作包另建一份仓库。

Kisaki、Vantage、Kana、libmpv-node 和 oauth-relay 分别维护自己的临时仓库与新工程历史，不能把独立项目的实现放进 Kisaki 临时库。Kisaki 内的公共包、官方扩展和分发资料继续沿 monorepo 归属。仓库名称表达项目级持续开发用途，阶段与验证任务由分支、PR 和运行记录说明。实际名称、远端、可见性及接续进度由实施状态记录；改名时同步当前入口，历史证据保留当时的真实地址。

临时远端不改变正式包名、appId、npm 作用域、最终仓库地址和许可。私有阶段按[联调与公开边界](#private-stage)运行，不向公共 npm、正式下载、更新索引或生产服务交付。跨仓消费固定提交生成的真实制品，来源、版本和摘要随结果记录。

各仓库开始使用 CI 前，核对自身 Actions 设置、所需 runner、访问权限、账户额度、存储与产物保留条件，不把另一仓库的验证结果视为已经具备条件。沿用实际已授权的设置，不因额度或权限不足自行付费、提前公开或缩小验收范围。无法读取额度时记录未取得信息，不记作零使用或无限额度，规则见 [GitHub Actions 用量](https://docs.github.com/en/actions/concepts/billing-and-usage)。

每次验证固定提交、锁定输入与目标环境，按所属工作内容保存结果。需要继续使用的 Actions 附件、候选制品及报告在保留期结束前另行保存，记录摘要和取得位置，不能依赖临时库或工作流附件始终存在。

项目达到正式接续条件后，按实际授权处理以下工作：

1. 核对新工程的交付状态、历史、候选制品和证据，完成来源仓库所需的[存档与重建](#archive)。已有旧公开仓库保留到相应操作条件满足，新工程开发不要求提前撤下旧入口。
2. 将临时库中的完整新工程历史接续到正式仓库，保留初始提交及正常开发提交的身份。按实际仓库情况完成已确定的建仓、重建或名称切换，不重新制作一条无法追溯的新历史。
3. 核对正式远端、协作规则、必需检查、发行身份和平台绑定，并转存仍需保留的讨论、验证记录与制品。历史 CI 结果继续说明原运行来源；正式仓库所需的配置和发布检查单独完成。
4. 确认正式入口、归档及取得路径有效后，再按实际授权处理不再使用的临时远端。仓库接续、公开可见性、包发行和服务切换分别记录，临时开发结束不自动触发其他动作。

通用规则由本篇维护，当前阶段由[实施状态](../../implementation/status.md)记录，实际运行由[验证证据](../../verification/evidence/README.md)保存，不为单个工作包另设一份并行的仓库接续规则。

<a id="archive"></a>

## 存档与仓库重建

Kisaki 的重建包括删除旧远端后建立同名仓库，不只创建 orphan 分支。原 process-list 完成存档后以 Vantage 重建，旧远端撤下和新入口建立列入具体重建操作。旧问题编号、链接和仓库设置不会自然继承；旧分支、tag、PR 和发行附件不重新挂入新仓库，npm 发布记录则继续保留。

原 kisaki-extensions 在有用内容合入 monorepo、独立存档完成且新分发入口验证后撤下。源码已经合仓不单独构成删除远端的依据，具体撤下范围须列入重建操作。

存档包括以下内容：

- Git 镜像中的可取得 refs、对象和实际 LFS 内容。
- 工作区尚未提交的设计资料及其他有价值内容。
- GitHub issue 和 PR 的正文、评论、评审及所需附件。
- Release 元数据和发行文件。
- 实际存在且需要保留的 Wiki、Discussion 和部署资料。

普通 clone 不覆盖全部平台资料，存档也不承诺恢复原编号和所有平台状态，范围依据 [GitHub 备份说明](https://docs.github.com/en/repositories/archiving-a-github-repository/backing-up-a-repository) 核对。存档放在来源仓库和待清理目录之外，记录来源、覆盖范围及摘要，并验证能够读取。

用户资料、凭据和本地环境不进入公开仓库。继承的代码、资源与人工贡献保留来源和版权声明，按 [许可规则](licensing.md) 处理。已有 issue 和 PR 按实际诉求整理：已经覆盖的内容关联对应实现，仍有效但未完成的需求进入工作记录；依赖机器人提出的问题由现行依赖维护流程处理。

五个项目的新工程历史首次提交标题统一为 `chore: initial commit`，省略 scope，表示该项目新历史的起点，并遵守[提交消息规范](workspace.md#collaboration)。在临时库中建立的这条历史继续用于正式仓库接续，不在切换时另造初始提交。

初始提交包含可运行基线、目标结构、任务入口与对应的构建和运行验证，不使用空提交或旧目录快照代替工程基线。建立 main 后配置 PR、必需检查、Squash 和分支清理；根提交不自动触发发行。后续保留正常、可审阅的开发历史，不在最后压缩成无法追溯的单次提交。

重建前的操作清单列出对象、保留内容、前置条件、执行顺序、可恢复范围和完成后的检查。不得复用已经消耗的 npm package@version，也须检查 [immutable releases 对旧 tag 的限制](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)。数据库不兼容不能作为删除全部历史的理由。

<a id="private-stage"></a>

## 私有联调与公开发布

各项目的临时开发仓库与新建或重建的正式仓库，在本项目公开条件满足前保持私有，只向获授权的参与者开放。已有旧公开仓库按[存档与重建](#archive)处理，不因新工程进入临时开发阶段改变其可见性。此阶段不发布新的 npm 版本，不建立付费私有 registry，也不把已有公开包改成私有。beta 或 rc 标签不会隐藏公开内容；仓库可见性、npm 访问权限和 package.private 是不同设置，分别按 [私有包](https://docs.npmjs.com/about-private-packages/) 与 [包可见性](https://docs.npmjs.com/changing-package-visibility/) 规则处理。

跨仓联调使用固定提交构建的实际 .tgz、原生平台包和资源归档，记录来源与哈希。在仓库外检查安装、导入、类型、CSS、真实调用和完整依赖，不使用源码 link，也不把临时凭据写进正式合同。

registry 可以使用隔离测试源。桌面制品、.kisx 和更新资料留在受限 CI 或测试环境，不嵌入长期 GitHub 或 npm 凭据。私有仓库不保证 GitHub Pages 也是私有，因此测试阶段不部署公开 dist 或正式下载索引，见 [Pages 访问规则](https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)。先在受限环境验证生成和读取，再随正式公开部署静态资料。

私有阶段仍执行 PR、CI 和 Squash 流程。缺少必需条件时，保持仓库私有，停止依赖该条件的合并或发布，并记录缺项；独立的本地实现与核验可以继续，但不能代替尚未通过的平台检查。不得减少检查、提前公开或自行付费，相关限制见 [私有仓库分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。

每个项目完成适用功能、制品、仓库外消费验证及[项目文档交付](documentation.md#lifecycle)后，核对源码历史中的私密内容、许可来源和发布身份，再公开对应仓库。桌面须覆盖六个目标。公开过程保留已验证的制品字节，并在公开后验证实际 npm、下载、更新、OIDC 和 provenance。私有阶段不能宣称已经具备公开 provenance，限制见 [trusted publishing](https://docs.npmjs.com/trusted-publishers/)。relay 源码公开和运行服务切换分别核对、分别执行。

<a id="application"></a>

## 应用身份与公开地址

| 对象                | 正式发行          | 应用自身开发构建      |
| ------------------- | ----------------- | --------------------- |
| 显示名称            | Kisaki            | Kisaki Dev            |
| appId               | me.kisaki         | me.kisaki.dev         |
| 普通业务 deeplink   | kisaki://         | kisaki-dev://         |
| Linux .desktop 文件 | me.kisaki.desktop | me.kisaki.dev.desktop |

正式应用身份不随版本、架构或普通与便携模式变化，beta 和 rc 也不自动成为可并行安装的新产品。Windows AppUserModelID 和 macOS CFBundleIdentifier 对应 appId；Linux 的 .desktop 文件名、desktopName、portal 与窗口关联保持一致。身份必须按 [builder 配置](https://www.electron.build/v26/docs/configuration/) 和 [Linux 窗口关联](https://www.electron.build/v26/docs/linux/#window-association-desktopname--syncdesktopname) 实际验证，不能只检查 appId 字段。

应用自身的开发构建使用独立资料目录和协议 scheme。直接调用 Electron setName 不会完成全部操作系统身份切换，见 [应用名称接口](https://www.electronjs.org/docs/latest/api/app#appsetnamename)。第三方扩展开发通过指定的真实应用和隔离资料运行，不伪装另一份已安装应用；OAuth 回调仍使用 loopback。

| 公开入口                                                        | 职责                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `https://kisaki.me`                                             | 项目主入口；桌面发行链接与静态分发资料使用下列固定地址                                         |
| `https://dist.kisaki.me`                                        | 由 GitHub Pages 托管的静态分发资料，沿 [发行元数据部署](releases.md#metadata) 的生成与部署流程 |
| `https://dist.kisaki.me/release-notes/<完整 tag>.json`          | 某一发行项目、某一版本的说明；语言按所属发行要求提供；身份规则见[发行规范](releases.md#release-identity)           |
| `https://dist.kisaki.me/release-notes/desktop@0.1.0.json`       | 桌面 0.1.0 的发行说明                                                                          |
| `https://dist.kisaki.me/release-notes/extension-sdk@0.1.0.json` | 扩展 SDK 0.1.0 的发行说明                                                                      |
| `https://dist.kisaki.me/registry/index.json`                    | 官方已签名扩展注册表                                                                           |

dist.kisaki.me 由 GitHub Pages 托管 Kisaki monorepo 已发行项目的静态说明和官方扩展注册表，覆盖桌面、公共包和官方扩展。安装包、.kisx 及大型归档继续放在 Releases，公开库发布到 npm。静态分发可以独立发布，不为更新和 registry 各增设子域。

官网源码归 site，Web 应用源码归 clients/web，二者的具体产品实现不在当前范围。官网使用已发布的发行与分发信息，独立构建和部署；源码同仓不要求与 dist 使用同一个部署项目。未来服务端以 server 为候选归属，公开范围与许可确定后再决定实际纳入；目录分类不能在同一公开仓库中隔离私有源码。oauth-relay.ximu.dev 仍是独立服务和部署，不因产品服务端同仓而改变归属。

<a id="npm-history"></a>

## 包版本与退役

| 包范围                                                                 | 交付与退役规则                                                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| @kisaki3/extension-sdk、extension-cli                                  | 保留名称，以新的正式版本交付当前公开合同及实现；执行前重新核对实际状态                                                                             |
| @kisaki3/extension-registry                                            | 分发格式与签名职责由新 extension-distribution 承接；新入口实际可取得后再明确退役旧包，不撤回旧版本或建立永久转发包装                               |
| @kisaki3/extension-api                                                 | 保留发布名，以新版本交付完整扩展 API；本体共同定义与制品格式分别归 desktop-contracts、extension-distribution，新版可用后仅按实际范围标记旧版本退役 |
| @kisaki3/extension-ui-vue                                              | 新 Solid UI 可用后标记旧版本退役，说明技术栈变化，不声称只换包名即可兼容                                                                           |
| create-kisaki-extension                                                | 创建器职责并入 extension-cli，新入口可用后标记旧包退役，不交付永久包装                                                                             |
| @ximu3/process-list 及其已发布 Windows x64 平台包                      | 由 @ximu3/vantage 及其对应平台包承接；新入口实际可取得后按替代范围退役旧入口，保留既有发布记录，不建立永久兼容包装                                 |
| appearance、ui、desktop-contracts、Vantage、Kana、libmpv-node 等新增包 | 按作用域核对真实包身份与权限，查询无记录不等于取得名称                                                                                             |
| @kisaki3/extension-distribution                                        | 执行前核对可用性、权限和制品；不将目标名称视为已经发布                                                                                             |

已有 npm 名称和发布记录保留，不通过常规 unpublish 撤回版本，也不为私有测试收回旧访问权限。[已经使用的版本号不能再次使用](https://docs.npmjs.com/policies/unpublish/)，仓库中的版本字段也不能证明对应版本已经发布，执行前逐包核对。

替代入口可取得后，deprecate 只针对明确的旧包或旧版本。仍在使用的新包保持正常发行，旧 tarball 留在原记录中。新实现按新合同交付，无需永久转发包装或旧格式兼容。

桌面、公共包、官方扩展和独立项目的首个正式版本分别从 0.1.0 开始。预发布使用 0.1.0-beta.N 或 0.1.0-rc.N，未公开基线使用 0.1.0-dev.0。各项目独立安排版本与发行时间，并管理自己的平台包和 Cargo 版本。

采用版本前检查真实占用情况和依赖关系。发行由明确的版本 PR 决定，仓库重建不能重置发布平台已经记录的版本。

<a id="npm-publishing"></a>

## 首次 npm 发布与 OIDC

已有包按新的 owner、repo 和 release.yml 配置 trusted publisher。每个新增包，包括原生平台包，都要分别建立 npm 身份；同一仓库发布过其他包不代表新包已具备身份。

私有测试完成、源码公开且首个版本 PR 合并后，CI 从同一固定发行提交构建并校验实际 .tgz，再执行首次公开发布。首次发布使用短期 granular token，只授权所需 scope 的发布，不授予组织管理权限，并仅供首次 job 使用。有效期覆盖交付时间，按 [token 规则](https://docs.npmjs.com/creating-and-viewing-access-tokens/) 和 [scoped public 发布规则](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) 配置所需 Bypass 2FA。

缺少凭据时停止建包，不发布占位内容，不改发另一文件，也不在本机平行发布。public 访问、临时 tag、依赖发布顺序和最后的 dist-tag 更新遵守 [发行流程](releases.md)。GitHub-hosted 首次发布显式生成 provenance 并核对结果；[来源证明](https://docs.npmjs.com/generating-provenance-statements/) 不代表代码安全已经通过验证。

包建立后，后续发布使用绑定实际仓库 release.yml 的 trusted publisher，并分别启用直接 npm publish 和 dist-tag 管理权限。两项权限独立，不能只配置 OIDC 就假定已经齐全。使用 OIDC 管理 dist-tag 时，npm 11 至少为 11.21.0，npm 12 至少为 12.2.0；CI 明确锁定并验证所用 npm CLI，不从 Node 或 pnpm 版本推定该能力，具体按 [trusted publishing](https://docs.npmjs.com/trusted-publishers/) 核对。

新建的 trusted publisher 配置须在两天内完成首次成功发布，才会验证并绑定仓库的不可变身份；逾期未验证的配置须删除后重建。因此，在下一次真实 OIDC 发行前安排建立或重建绑定，确保该次发布处于验证窗口内，不在发行时间尚未确定时提前创建后长期搁置。已有包迁入新仓库时也遵守这一条件。

首次发布成功后撤销 token 和 CI 秘密，不为等待后续 OIDC 验证而保留。后续只使用 OIDC，失败时不回退到长期 token。下一次真实发行验证 OIDC 和自动 provenance，不为验证而发布空版本。

首次发布使用本节的一次性 token 流程，后续发行使用 OIDC。同名重建的仓库须按新身份逐项建立 OIDC、Pages 和服务配置。版本 PR 合并后自动发布。

<a id="collaboration"></a>

## 协作与公开反馈

本地及 agent 的 GitHub 平台操作使用 `gh` CLI；Git 版本管理使用 `git`。

五个仓库仅接收本人和受邀协作者的 PR，公开后仍采用 GitHub 原生 [Collaborators only](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/disabling-pull-requests) 设置。仓库不维护用户名白名单，也不使用自动关闭外部 PR 的机器人。PR 限制不影响公开源码读取、使用、第三方扩展开发或 Issues 反馈，不以全仓互动限制替代。

agent 按明确授权的账户或自动化身份执行任务，没有特殊权限，也不默认新建机器人账号。同一账户下的人和 agent 没有独立平台权限；agent 不能通过自我 Approve 充当独立审查。创建、更新、合并和发布都依据实际授权，CI 与维护者核验后通过 Squash 接纳，流程见 [工作区协作](workspace.md#collaboration)。

README 简要说明个人维护、受邀 PR、Issues 和 [TG](https://t.me/kisaki3) 反馈入口。CONTRIBUTING 说明环境准备、验证、PR 与版本流程，AGENTS 提供必要规则和引用。独立项目按自身命令编写手册；公开反馈集中在 Issues 和 TG。

PR 使用自由正文，不设置预填模板或强制勾选项。作者按改动需要撰写，说明问题、最终行为、必要理由和实际验证，篇幅随复杂度确定，未执行的检查如实说明。评审后修改实现时同步修改说明，Squash 标题遵守英文提交规范。版本清单由工具生成。协作配置只作用于新仓库，旧仓库按存档流程撤下。

依赖安全告警和可生成的修复由 Dependabot 提供，常规升级按需进行并由维护者检查。普通 job 不接触发布秘密，权限遵守 [平台规则](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot-on-github-actions)。

<a id="issues"></a>

## Issue Forms

仓库只提供 Bug report 和 Feature request 两份英文表单。Feature request 同时接纳新功能和已有功能改进，入口说明为“Suggest a new feature or an improvement to an existing one.”。

表单标签、提示和占位文字统一使用英文，提交标题和正文可以使用简体中文、繁体中文、英语或日语，无需翻译。标题不强制 Bug 或 Feat 前缀，也不要求 Conventional Commit 格式。维护者自己的技术任务可以使用普通 issue 或工作记录。

Bug report 使用以下字段：

| 字段                                 | 必填 | 提示与接纳内容                                                                                           |
| ------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------- |
| Version（version）                   | 是   | 应用或包的完整版本；未发布构建填写提交或构建标识                                                         |
| Environment（environment）           | 是   | 系统及版本；库或工具填写相关运行环境。架构、安装文件名及扩展信息在相关时补充，不要求用户识别所有技术细节 |
| Problem（problem）                   | 是   | 做什么时出现了什么问题；预期行为不明显时一并说明，不强制拆成两个重复字段                                 |
| Reproduction（reproduction）         | 否   | 已知操作步骤、发生条件或最小示例；偶发或暂未找到稳定步骤也可以提交                                       |
| Additional information（additional） | 否   | 相关截图或日志片段；无需上传整个资料库、用户媒体、令牌或完整环境配置                                     |

各仓库收集与问题相关的环境信息：原生项目关注系统、架构与 runtime，Kana 关注文档格式和运行环境，relay 关注来源与失败阶段；官方扩展或包的问题补充名称和版本。提交者描述实际现象即可。Kisaki 的[关于页环境复制功能](../ui/navigation.md#menus)是可选辅助。报告不索取完整资料库、媒体、secret、授权 code 或 token。

Feature request 使用以下字段：

| 字段                                 | 必填 | 提示与接纳内容                           |
| ------------------------------------ | ---- | ---------------------------------------- |
| Problem or use case（problem）       | 是   | 当前在哪一步遇到限制，或希望完成什么事情 |
| Desired outcome（outcome）           | 是   | 用使用者能观察到的结果描述建议           |
| Examples or alternatives（examples） | 否   | 示例、当前绕行方式、参考产品或补充说明   |

先建立 bug 和 enhancement 标签，再让表单引用。状态使用 issue 的开关和关闭原因，提交者按表单描述现象或期望；维护者根据实际处理情况跟进，问题保持开放直到明确关闭。表单语法见 [Issue Forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)。config.yml 设置 blank_issues_enabled: false，维护者仍可通过 Maintainers only 创建空白 issue；contact_links 指向已有 TG，配置见 [Issue 模板设置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)。

日常交流使用 TG，需要持续跟踪的问题使用 Issues，不要求先到群里咨询。有安全影响的问题可以先联系维护者，再私聊敏感细节；群本身是公开场所，不应张贴凭据。项目不新增 SECURITY.md、专用漏洞表单、响应时限或反馈平台。
