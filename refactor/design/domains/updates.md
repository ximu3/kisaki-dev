# 应用更新

updates 负责发现和选择应用发布版本、检查更新、准备下载，以及将已准备制品交给安装流程。主窗口的更新 Dialog 展示这些状态。安装前的退出协调复用 app 的共同退出流程。

<a id="entry"></a>

## 更新入口与自动检查

自动检查默认开启，在应用启动就绪后执行一次，此后每 24 小时检查一次。频率固定，用户始终可以手动检查。应用默认不接收预发布版本。这两项偏好由 preferences 保存，不能代替扩展各自的预发布选择。检查只获取更新信息，不自动打开界面、下载或安装。

用户从主窗口左下角的应用菜单、应用搜索或更新偏好中的相关入口打开同一个更新 Dialog。它使用共同 Dialog 宿主，不建立专用窗口、renderer 或 preload。偏好页编辑更新设置草稿，检查、下载和安装由更新 Dialog 组织，并使用正式保存的偏好。打开或关闭 Dialog 都不隐含提交偏好草稿。Dialog 展示当前版本、候选版本、正在准备和已经准备的版本，并提供检查、下载、明确取消，以及安装并重启。

关闭 Dialog 不取消已经接纳的准备工作，重新打开后继续观察。新的检查结果不会替换用户已经选择或正在准备的版本，检查失败也不能显示为“已是最新”。安装前用户取消退出时，已准备内容继续保留。

<a id="selection"></a>

## 发布发现与制品选择

应用更新只接受精确匹配 desktop@<合法 SemVer> 的标签，发行名遵守[统一规则](../engineering/releases.md#release-identity)。发现过程须处理足够的候选及分页，排除 draft，根据用户偏好筛选预发布，并核对发布元信息。最终从允许范围中选择高于当前版本的最高版本，不隐式降级。GitHub Latest、Atom 的第一项以及同仓其他包或工具的发布时间，都不能决定应用版本。

候选制品必须匹配系统版本、平台、架构和当前分发载体。inApp 使用已选 release 的准确资产目录与目标通道，交给 electron-updater 的 generic feed，复用其下载、校验、缓存和安装能力。执行器不能再通过 GitHub 自动挑选另一发布族。manual 则提供对应制品的下载入口。不同载体的规则见[构建交付](../engineering/build.md)。

updates 拥有候选与操作状态，执行器适配工具事件并执行安装。prepare 发起下载准备，installAndRestart 完成退出协调后交接安装；底层自动下载及退出时自动安装保持关闭，所有产品动作由这两个完整入口驱动。

主进程重新核对界面传回的 release、URL、摘要、受控来源及实际制品身份。需要验签时，验证过的版本和摘要必须绑定最终选中的字节，不能验证一份旁路元数据后，再从可变化的 latest 获取安装包。发布发现、来源认证、准备、退出和本机安装是不同阶段，一步成功不能代替后一步的完成事实。

<a id="api"></a>

## 原生操作与状态

原生更新能力提供以下操作：

| 原生入口                         | 完整操作与结果                               |
| -------------------------------- | -------------------------------------------- |
| updates.getState / observe       | 当前版本、检查结果、准备结果和正在进行的操作 |
| updates.check()                  | 完成一次检查，返回明确候选或没有更新         |
| updates.getReleaseNotes(release) | 读取指定版本的本地化说明，失败独立于更新准备 |
| updates.prepare(release)         | 准备指定发布版本，完成后才称为可安装         |
| updates.installAndRestart()      | 执行完整退出协调，并交接已准备的更新         |

公共值属于 desktop-contracts/updates。ApplicationRelease 包含 version、严格的 tagName、releaseUrl、publishedAt 和 delivery。发行说明另行读取，不用一个可空正文字段混合表示未读、缺失与失败。delivery 根据真实构建载体及安装归属判别，不依据普通或便携数据模式。

inApp 包含选定的 files，每项具有绝对 url、可空 size 和 sha512，摘要使用所选 electron-updater 的格式，不复用扩展 SHA-256。manual 包含绝对 downloadUrl，不生成待安装结果。

check() 完成检查后返回 ApplicationRelease 或 null。null 只表示检查成功且没有更新，失败则拒绝调用。prepare(release) 固定准备指定版本，同一时刻只允许一项准备。验证全部完成后才返回 PreparedApplicationUpdate，其中保留 version、tagName 和所选文件身份，不公开准备路径。失败或取消不改变当前安装，未完成的包不能进入 prepared。

getState 和 observe 返回 currentVersion、check、prepared 与 operation。check 为 notChecked、upToDate、available 或 failed；完成检查后带 checkedAt，available 带 release，failed 带 error。prepared 保存实际已准备结果或 null。operation 为 checking、preparing、installing 或 null，有托管任务时附上真实 taskRef。开始新检查不会清空上一次结果，检查失败也不会清除已准备制品。

observe 先交付完整快照，再交付变化，释放只停止观察。准备任务通过 tasks 明确取消，不能仅清空 prepared 就表示工作已经停止。安装入口固定此次 prepared，并通过[共同退出](../ui/navigation.md)处理未保存编辑、运行中的游戏和必要收尾。用户取消、游戏尚未退出或收尾失败时，都保留 prepared。只有退出许可与收尾都完成，执行器才能接手；不能提前启动具有强制退出期限的 helper。

安装不返回 TaskRunRef，也不承诺旧进程能确认跨重启后的成功。旧进程只确认退出和交接，成功路径会终止当前调用环境。新进程根据实际版本建立状态，不恢复一个虚假的 installing。交接前的失败或取消可以在旧进程中反馈，交接后则不能假装已经回滚。

<a id="delivery"></a>

## 各分发载体的行为

Windows ZIP 始终使用 manual，无论用户采用普通还是便携数据目录。应用可以检查更新、读取四语发行说明、展示候选和下载入口，再通过外部打开让用户下载并解压换版。prepared 保持 null，主进程拒绝 prepare 和 installAndRestart。不支持自动替换不能被显示为没有更新，也不能自动改用 NSIS 安装版。

官方直接分发的 DEB 和 RPM 使用 inApp，准备格式与架构匹配的包，在共同退出及系统授权完成后调用包管理器。权限、依赖变化、失败后的实际包状态和恢复过程必须通过平台验证。软件源或商店发行使用自己的渠道，应用不与渠道同时自更新，也不能把官网包链接当成渠道更新。其他支持的安装形态及 AppImage 替换失败后的手动恢复，依[构建交付](../engineering/build.md#updates-and-portability)执行。

<a id="notes"></a>

## 发行说明与验收

getReleaseNotes(release) 根据已经核验的 desktop tag 和官方发布配置生成 `https://dist.kisaki.me/release-notes/<完整 tag>.json`，读取 ApplicationReleaseNotes。结果包含 project、version、defaultLocale 和 releaseNotes: LocalizedText；project 必须为 desktop，version 必须等于本次发布版本。外部 JSON 还须验证语言和正文，不接受 renderer 提供的任意 URL，也不能用同仓公共包的说明代替桌面说明。桌面读取合同归 updates 所有，静态投影遵守[发行规范](../engineering/releases.md#metadata)。

正式发布提供四语说明。说明读取失败时独立显示问题，并允许重试或打开 releaseUrl；这不会清除候选和准备结果，不表示没有更新，也不阻止有效安装包的准备。说明读取不进入 operation，也不建立任务。缓存依据确切版本和 HTTP 校验管理；切换语言只根据当前有效 UI 语言及 defaultLocale 重新选择文本。

Markdown 使用受限呈现，不能执行正文中的安装指令。修正发行说明不会改变版本或首次发布时间，也不要求用户重新下载安装包。

验收覆盖混合发布族、稳定版与预发布、乱序结果、分页、当前版本高于候选、缺少目标制品、元数据损坏、网络失败、重复检查、说明读取失败及已准备结果保留。退出和安装必须使用各载体的真实制品验证，发行发现与安装统一使用本篇定义的标签与制品合同。
