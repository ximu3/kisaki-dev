# 扩展包、仓库信任与版本采用

manifest 描述一个扩展版本的包内事实，registry 发布可获取制品及其签名，本地记录保存当前安装、启用意愿和明确选择的更新来源。发现版本、准备安装包、采用版本和激活实例各是独立事实，本篇规定它们之间的衔接和失败处理。

<a id="package"></a>

## 作者声明与安装包

package.json.version 是唯一版本来源，package.json.kisaki 保存扩展专属元信息，kisx.config.ts 描述构建。工具据此生成 manifest.json 和包内入口、资源。产品中的扩展 ID 不必等于 npm 包名。安装包不绑定仓库、下载地址或签名，可以直接安装，也可以被多个仓库收录。

manifest 必须包含 schemaVersion、id、version、apiVersionRange、targets、entry、defaultLocale 和 name。可选字段包括 description、categories、keywords、icon、readme、author、license、homepage、repository、issues，以及 nodeVersionRange 和 electronVersionRange。schemaVersion 表示格式版本，version 表示扩展发布版本，apiVersionRange 表示所需扩展 API 的 SemVer 范围，不能用桌面应用或 SDK 版本代替。author 包含名称和可选地址，网页字段使用 URL，entry、icon 和 readme 使用包内相对路径。

扩展与仓库声明的 id 可以是单段，也可以是点分多段。每段只含小写字母、数字和连字符，以字母开头，以字母或数字结尾，不能有空段，也不强制至少两段。前缀可以推荐使用作者或项目名，但程序必须将完整 ID 视为不透明值，不能据此推断权限、作者或域名。修改展示资料或仓库不会改变 ID。

.kisx 是 ZIP，根目录包含完整 manifest、已构建的 ESM 入口，以及必要资源和运行依赖。安装时不运行 npm install 或构建脚本。相对路径统一使用 /，解包和读取都限制在包根目录内，拒绝路径冲突、符号链接和改变归属的内容。包身份不从文件名推断。语言扩展同样通过代码 activate，不提供静态语言包或 manifest 贡献。Webview 的 document 在运行时登记，与 Node entry 分开。

共用代码通过普通 npm 依赖随扩展交付。扩展之间通过已开放的本体参与合同协作；Profile 引用其他 provider 时，在实际调用前检查可用性。轻量激活只登记本扩展当前具备的贡献。

<a id="compatibility"></a>

## 目标、兼容与不可变制品

targets 必填、非空且去重，枚举值为 windows-x64、windows-arm64、macos-x64、macos-arm64、linux-x64 和 linux-arm64。按宿主操作系统与进程架构匹配目标。一个包可以覆盖多个目标，同一版本内每个目标至多对应一个制品，匹配结果与列表顺序无关。增加目标通过新版本发布。

manifest 必须提供 apiVersionRange。公开 API、SDK 接入协议与本体构建标识按[版本合同](../engineering/protocols.md#versions)分别核对；存在额外运行条件时，再声明 Node 或 Electron 的 SemVer 范围。兼容范围只表达运行条件，扩展的 API 权限与原生 ABI 各按自己的边界验证。

修改内容或提供面向新运行时的制品时，增加扩展版本。同版本、同目标保持字节不变。发布项的 SemVer 优先级相同则报告冲突，上传时间、数组顺序和 build metadata 均不参与选版。

仓库选择、仓库安装、本地包安装和激活共用兼容检查。系统根据平台、API、运行条件和每个扩展的预发布偏好，选择最高可用版本。allowPrerelease 默认 false。手动选择旧版或预发布版不会改变该偏好，自动更新只选择更高版本，不自动降级。明确选中的包下载或验证失败时直接报告，不改用旧包或另一制品。应用升级后，已安装扩展若不再兼容，应保留安装包、数据和启用意愿并停止加载，展示实际不满足的条件。

目录的当前展示资料不决定安装版本。旧包可以正确声明与当前目录不同的名称或简介，不能因此被误判为无效。

<a id="registry"></a>

## 单文件索引与展示资料

```text
schemaVersion, id, publicKey
defaultLocale, name, description?
extensions[]
  id
  defaultLocale, name, description?
  categories?, keywords?
  author?, homepage?, repository?, issues?
  icon?
  releases[]
    version, publishedAt, defaultLocale
    releaseNotes?, readme?
    artifacts[]
      targets, apiVersionRange
      nodeVersionRange?, electronVersionRange?, license?
      url, size, sha256
signature
```

每个仓库使用一个平铺索引，包含仓库资料、扩展当前展示、全部提供版本及制品，以及 signature。索引不增加 summary、signed、releaseIndex 或下级版本索引。文件引用使用 { url, size, sha256 }，其中 size 是原始字节数，sha256 是小写十六进制 SHA-256。包、图片和 readme 字节不内嵌。索引变化后需要全量重新获取，这是该格式的明确成本。

工具从最高稳定版的 manifest 和资源生成当前展示；没有稳定版时才使用最高预发布版。上传时间、访问平台、安装版本和未发布源码都不决定当前展示。同版本的多平台包必须具有一致的共同展示信息。

每个 release 保存 version、首次发布时的 UTC 毫秒 publishedAt、defaultLocale，以及可选 releaseNotes 和 readme。每个 artifact 保存 targets、API 范围、可选运行范围与 license，以及 URL、大小和哈希。兼容条件和许可证属于具体制品，不能拿当前值套用旧包。完整 manifest 仍保存在包内。

安装先验证字节数和哈希，再核对包内 id、version、targets、兼容条件和入口是否与选定制品一致，不能只信任目录声明。图标和说明也按引用验证。浏览目录不需要逐包读取 manifest 或执行扩展代码。

URL 支持绝对与相对地址，相对地址统一以索引最终响应 URL 为基准。接收方先验证原内容的签名，再解析引用；用户保存的入口仍保持原值。格式不另设 baseUrl、pathMode 或 signatureUrl。

传递索引片段时，保留原基准或使用已经解析的完整 URL，嵌套层级不改变解析依据。

包独立于仓库。发布者可以只交付包，由维护者生成资源、哈希和索引并签名。部署必须明确执行，先发布包与资源，再以同一个文件更新索引和内嵌签名；旧引用仍保持可读。构建不暗中发布或签名。删除版本后重新选择当前展示，没有剩余版本时移除目录项，本地安装不受影响。协议不提供 yanked、yank、unyank 或永久发布历史。

<a id="release-notes"></a>

## 版本说明与目录文案

```ts
type LocalizedText = string | Record<string, string>
```

manifest 和 registry 的 name、description，以及运行时菜单标题共用 LocalizedText，静态值不需要执行扩展函数。字符串原样使用；多语对象必须有 defaultLocale 对应的值，并按 [i18n 规则](../ui/localization.md#localized-text)进行精确匹配和文字体系匹配，不能任取第一种语言或自动进行简繁转换。身份和字段标识不翻译。

categories 按用途多选 metadata、integration、theme、tool 和 language，分别表示资料识别获取、同步联动、主题创作、辅助操作与主应用译本；也可以为空。未知分类保留原值并使用展示回退。分类只参与用途展示，能力、权限、兼容性、加载方式和语言优先级按相应合同独立确定。keywords 保存自由文本，内容类型、官方或实验性标记及安装状态使用各自字段。

releaseNotes 以 Markdown LocalizedText 内联保存在对应 release 中，同版本各平台共用一份，正文可以说明平台差异。release 保留发表时的 defaultLocale，说明正文只供阅读。旧版说明按当前索引提供的范围浏览；缺少时显示作者未提供版本说明。

官方扩展每个版本遵守[发行说明语言要求](../engineering/releases.md#notes)，缺少必需语言时不能发行。第三方可以省略，不影响安装。作者提交经过审阅的说明；修正错字或补充翻译时重新签名索引，不改变包版本或字节，见[发行规则](../engineering/releases.md)。扩展自己的 UI 可以使用普通 ICU 依赖，跟随宿主 locale 并保留界面状态；资料语言仍由 Profile 决定，SDK 不提供完整翻译框架。

<a id="trust"></a>

## 签名范围与首次信任

索引顶层平铺 schemaVersion、id、publicKey、展示资料、extensions 和 signature。publicKey 使用 Ed25519 SPKI PEM，signature 使用 Base64。签名覆盖所有根字段，只移除顶层 signature；未知新增字段同样参与，嵌套的同名字段不能移除。

签名输入先写入 UTF-8 用途前缀 `kisaki-extension-registry:v1\n`，其中末尾是一个 LF，再接移除顶层 signature 后的 [RFC8785 JCS](https://www.rfc-editor.org/rfc/rfc8785.html) UTF-8 内容。JCS 使用现成实现，Ed25519 使用 Node 实现，不自定键顺序或数字格式。重复属性和无法形成合法 JCS 的数据必须拒绝。

验证针对收到的原内容，不能先补默认值、裁剪未知字段或修改 URL。签名或格式错误会使本次仓库刷新失败；下载哈希错误只使对应读取或安装失败，不能宣称旧安装已损坏。签名包含原相对 URL 和哈希，不包含运行时解析出的最终域名。同一份签名索引换地址后不一定失效，但保存的更新来源仍须明确变更。URL 表达位置，哈希约束字节，资源不另行签名或加密。

官方仓库的首次信任公钥随应用提供。自定义仓库先通过 inspect 展示入口、仓库身份和公钥，由用户明确添加后保存信任；用户可以查看指纹，无须手工抄写 PEM。响应自带公钥和签名不构成独立作者认证。后续刷新只使用本地已信任公钥，不能自动采用响应中的新公钥；换钥必须明确重新绑定。签名既不证明代码安全，也不证明目录是最新的。

信任对象是用户选择的仓库。其他仓库中相同 ID 的更高版本不能接管更新。撤销信任或切换来源会撤销对应的待采用包；暂时离线则保留安装和已验证准备。索引不再收录某个版本，不会自动卸载、停用或降级已经安装的扩展，已准备内容仍按固定制品明确采用。

<a id="repositories"></a>

## 本地仓库配置与更新绑定

extension_repositories 保存本地仓库配置。

| 字段               | 含义                                   |
| ------------------ | -------------------------------------- |
| id                 | 本地稳定主键                           |
| url                | 用户保存的仓库入口地址                 |
| declared_id        | 用户确认过的远端仓库 ID，对应索引的 id |
| trusted_public_key | 已确认信任的公钥                       |

id 是本地稳定主键，declared_id 是用户已经确认的远端声明，并遵守[ID 格式](#package)。同名仓库或入口地址变化不能自动接管绑定。name、description 和发布目录来自经过验证的索引，不是可写配置。索引中的公钥声明与本地 trusted_public_key 具有不同权威，前者不能覆盖后者。

| 仓库接口                           | 含义                                       |
| ---------------------------------- | ------------------------------------------ |
| repositories.list / get            | 读取配置及管理信息                         |
| repositories.inspect(url)          | 读取可供用户确认的仓库身份及公钥信息       |
| repositories.add / update / remove | 维护本地配置，编辑沿相关字段 expected 规则 |
| repositories.refresh               | 按保存的身份和公钥验证并更新目录           |

这些方法位于 extensions.repositories。inspect 只返回待确认信息，不建立信任。add 和 update 显式接收 url、declaredId、trustedPublicKey 及相关 expected；add 返回 repositoryId，修改和删除返回 void。refresh 按保存的身份及公钥更新目录，失败时返回操作错误，不顺便接受新的信任。只更换地址且可信身份保持一致时，可以保留绑定和已准备内容。

installed_extensions.update_repository_id 是引用 extension_repositories.id 的可空外键，通过 extensions.setUpdateSource(extensionId, repositoryId | null) 维护。文件安装不推断仓库，手动包更新保留原绑定。更换绑定会撤销旧来源的待采用更新。

删除仓库时，系统同时解除绑定并撤销相应准备内容，保留已安装版本、启用意愿和私有数据，不改投其他来源。重新添加相同远端 ID 不会自动恢复旧绑定。暂时连接失败也不会清除绑定。

文件缓存保存最后一次验证通过的索引、信任依据、响应基准和成功时间。浏览时先呈现缓存再刷新，失败后继续展示旧内容时间与本次错误；没有缓存时呈现尚未取得索引的状态。相对链接使用取得该缓存时的响应基准，缓存继续核对当前身份和信任条件。安装事实与已准备包由各自记录管理，缓存损坏后仍保留安装。

<a id="installation"></a>

## 安装事实、准备与中断

installed_extensions 对每个扩展 ID 保存一行权威记录，内容包括当前版本与所选制品、enabled、更新仓库、allowPrerelease 和可空 preparedUpdate。完整待采用值保存在同一记录中。包保存在验证通过的独立目录，由记录选择使用；扫描磁盘目录不会自动加载或登记扩展。

下载、校验和解包在独立位置完成，再通过短事务提交安装或准备记录。激活和占用结束后的字节清理分别完成，不能宣称文件系统与 SQLite 一并全量回滚。应用重启后重新建立 activation、宿主和进度，不恢复虚假的 active 状态。包缺失、损坏或不兼容时，保留记录、私有数据和启用意愿，不自动删除。

| 中断或失败位置             | 实际状态与后续操作                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| 包准备尚未完成或记录未提交 | 原安装保持；残留字节不是安装结果，可以清理，不能自动加载                                       |
| 已提交安装但激活失败       | 保留已安装版本及启用意愿，报告实际激活问题；不自动降级或回滚私有数据                           |
| 已准备更新后退出应用       | 保留固定制品，重启后可离线明确采用；普通启动或宿主恢复不自动采用                               |
| 安装文件丢失或损坏         | 保留安装事实与私有数据，显示实际问题；通过既有准备、采用完整包的流程恢复，不改投其他来源或版本 |

普通启动只加载当前已提交版本，不重放安装或业务，也不自动采用准备内容。字节必须在全部占用释放后才能清理，清理失败不推翻已经提交的正式事实。卸载时明确选择 privateData 为 keep 或 delete；storage 和 secrets 不随安装行级联删除。同 ID 再次安装时，按实际保留的私有数据读取。

官方和第三方扩展使用相同生命周期。应用不附带扩展或离线包，应用升级不会安装、覆盖或恢复已移除的扩展。用户从文件安装 .kisx 的入口保留。

<a id="operations"></a>

## 管理操作与更新采用

| 原生入口                                              | 完整操作与结果                            |
| ----------------------------------------------------- | ----------------------------------------- |
| extensions.list / get                                 | 已安装扩展摘要或详情                      |
| extensions.getState / observe                         | 当前运行情况与变化                        |
| extensions.install(source)                            | 完整安装并返回实际安装结果                |
| extensions.enable / disable                           | 完整启停，返回实际状态                    |
| extensions.uninstall                                  | 卸载，并按明确选项处理私有数据            |
| extensions.checkUpdates                               | 返回更新候选及各来源的检查问题            |
| extensions.prepareUpdate(extensionId, source)         | 准备明确制品并返回已准备的更新结果        |
| extensions.applyUpdates(preparedUpdates)              | 采用所选准备结果并返回采用与激活报告      |
| extensions.runtime.getState / observe / restart       | 查询与重建共享扩展环境                    |
| extensions.setUpdateSource(extensionId, repositoryId) | 修改指定扩展的更新仓库绑定，null 表示解除 |
| extensions.repositories                               | 仓库配置、读取、刷新与信任管理            |

install(source) 接受仓库中的具体制品或明确选择的 .kisx，默认启用并尝试激活。同 ID 已安装时不能静默覆盖，应使用更新流程。正常安装包含激活；如果包已安装但激活失败，ExecutionFailure.partialResult 应保留实际安装摘要和启用意愿，不能把整次操作描述为完全没有发生。

checkUpdates 只检查并返回候选和来源问题，不下载。prepareUpdate(extensionId, source) 核对目标，完成下载、验证和解包，再返回固定的 extensionId、version、sha256、targets 和 source，不修改运行状态或更新绑定。只有新准备成功后才替换旧结果，新准备失败保留旧结果。

applyUpdates 接收明确的准备值，并与宿主实际持有的内容核对。它不会重新查找最新版本或更换制品，也不把路径或 Task ID 当作制品身份。

| 变化                                       | 已准备更新的处理                                           |
| ------------------------------------------ | ---------------------------------------------------------- |
| 检查到更高版本或仓库暂时不可用             | 保留原准备结果                                             |
| 索引不再列出该版本                         | 已取得并验证的包仍可明确采用，后续不再从该索引新选这一版本 |
| 成功准备另一份更新                         | 替换此前准备结果；新准备失败保留旧结果                     |
| 用户切换更新来源、移除来源仓库或撤销其信任 | 撤销旧来源的待采用内容，已安装版本保持                     |
| 扩展被卸载                                 | 清理其未采用的准备内容，旧请求不重新安装扩展               |

手动准备不受无关仓库变化影响。applyUpdates 先按[实例关闭规则](runtime.md#disable)处理受影响视图，再在一次共享宿主重建中采用多个更新。正常完成表示所选项目都已处理，且应执行的激活尝试已经结束，结果返回 adopted 和 activations。结果允许部分失败，界面不能因此提示全部成功；单项更新也使用同一数组合同。未更新扩展的激活失败，不算作该扩展更新失败。runtime.restart 只使用当前版本，不顺带采用更新，并返回真实 activations。

共享宿主无法恢复、操作取消或流程无法继续时，按共同失败合同返回合法部分报告。报告只记录已尝试的项目，已采用版本保持已采用；激活失败和私有数据变化分别说明。

安装、替换和卸载按扩展互斥，共享宿主重建统一协调。异常恢复使用当前已提交版本，只恢复登记；待更新包和旧业务调用分别等待自己的明确操作。任务提供进度与历史，完整结果由业务操作交付。

这些管理能力属于原生 desktop-contracts。SDK 不开放安装卸载、仓库信任、更新采用、宿主重启或引导管理，扩展可以导航到相应界面。应用 updates 使用自己的发布输入和完整退出交接，不使用 ExtensionPackageSource。

内部实现按[主进程扩展模块的组织](runtime.md#organization)分工。扩展更新检查与准备属于 main/features/extensions/updates，对外仍是 extensions.checkUpdates 与 extensions.prepareUpdate；main/features/updates 只负责应用自身更新。完整更新采用和运行环境重建的编排仍属于 extensions，不因内部目录名称转移领域归属。

<a id="values"></a>

## 管理投影与结果值

### 安装与运行状态

安装摘要固定包含 id、version、enabled、updateRepositoryId、allowPrerelease 和 preparedUpdate；详情另行提供能够取得的 manifest。packageState 为 available、missing 或 invalid，invalid 附带 ErrorSummary，没有包时不制造 manifest。compatibility 为 compatible、incompatible 或 unavailable。incompatible 列出实际不满足的平台、API、Node 或 Electron 条件；缺少有效声明时为 unavailable，不能判断为兼容。

activation 为 { status: inactive | activating | active | deactivating }，或 { status: failed, error }。共享 runtime 的 status 为 stopped、starting、running、stopping 或 failed，失败时附安全 error。两层都提供当前快照和 observe，不能遗漏初次读取与订阅之间的变化。界面可以同时显示正在运行 1.4 和已经准备 1.5，不能压成一个互斥总状态。provider 的业务失败不会改变 activation 或 enabled。

### 制品来源与操作结果

ExtensionPackageSource 为 { type: repository, repositoryId, extensionId, version, sha256 } 或 { type: file, path }。仓库来源从已验证目录选择唯一目标制品；文件来源通过本体选择，Webview 不能任意提交主机路径。PreparedExtensionUpdate 固定 extensionId、version、sha256、targets 和 source。仓库来源保留声明与信任依据，调用者回传的值不能绕过哈希、信任或目标核对。

enable 和 disable 返回完整操作后的实际状态。uninstall({ extensionId, privateData: keep | delete }) 返回 void。checkUpdates 返回 { updates, issues }，每个 issue 关联 repositoryId 或 extensionId 并附 ErrorSummary；一个来源失败不否定其他来源候选。

applyUpdates 返回 { adopted, activations }。adopted 每项包含扩展 ID、请求的 version 和 sha256，以及该项 adopted 或 error 结果；activations 记录真实尝试过的激活。调用方逐项读取结果，整次中断时尚未发生的项目可以缺席。

repositories.refresh 返回成功取得的目录、取得时间和响应基准；失败时保留缓存并报告操作错误。预发布偏好通过独立操作明确修改，不能从手动安装推定。版本、签名、激活和各平台制品按[验收规则](../../verification/acceptance.md)验证，存在 DTO 本身不代表运行已完成。
