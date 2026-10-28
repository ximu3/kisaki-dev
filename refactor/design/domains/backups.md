# 游戏存档备份与恢复

library/holdings/game/backups 负责将游戏存档保存为完整归档，并恢复到明确目标。备份有自己的身份、来源和保留规则，不依赖启动配置持续存在。恢复过程保存可校验的操作凭据，使应用在中断后仍能判断实际目标状态并找到回退材料。

<a id="source"></a>

## 配置、来源与创建输入

每套启动配置可以指定一处存档位置：

| 字段                   | 含义                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| save_path              | 可选的实际存档路径，支持一个文件或一个目录                            |
| auto_backup_enabled    | 是否在确认游戏退出后自动备份，默认 FALSE                              |
| backup_retention_count | 当前来源保留的未锁定备份数量，只接受正整数，默认 5；NULL 表示不限数量 |

存档路径可以位于内容目录或工作目录之外，不能从游戏名称或这些位置推断。填写路径不会自动开启备份。文件来源只保存该文件，目录来源保存完整内容和必要的空目录。当前不支持多根映射、注册表存档或系统镜像。

来源缺失、不可读和确实为空分别处理。缺失或不可读不能产生空备份；空状态只能由用户明确手动保存，并在结果中标明。自动备份不能用空状态替换历史或触发清理。

```ts
type GameBackupSource =
  | {
      type: 'config'
      launchConfigId: string
    }
  | {
      type: 'snapshot'
      launchConfigId: string
      launchConfigName: string
      path: string
    }

interface GameBackupCreateResult {
  outcome: 'created' | 'unchanged'
  backupId: string
  issues: GameBackupIssue[]
}
```

config 分支在执行时读取指定配置，并固定本次来源。snapshot 分支使用已经确定的路径与名称，不重新选择当前首选。名称用于说明配置改名或删除后的来历。快照不包含预先保存的存档字节，实际内容在创建备份时读取。

游戏会话的 saveSource 直接使用 snapshot。即使启动时存档尚未生成，只要路径明确，也可以保存该路径。

创建输入必须明确给出 skipIfUnchanged。普通手动入口使用 false，确认游戏退出后的自动备份使用 true，其他调用按实际意图提供，不能根据来源或交互权限猜测。

只有允许跳过、同一来源内容未变化，并且已有可用备份时，结果才可以是 unchanged；backupId 指向该可用备份。来源不可读、缺失或已有归档损坏，都不表示“未变化”。

created 表示新备份已经正式登记。如果创建成功、清理旧备份失败，返回 created 并附 issues。归档或登记失败则遵守共同失败合同，临时文件不能称作已创建备份。GameBackupIssue 是本次操作报告中的问题值。

来源值不携带保留数量或自动备份开关。进入清理阶段时，再核对当前配置是否仍然适用。

<a id="automatic"></a>

## 自动备份的接纳时点

备份模块声明接收游戏结束事实的完整原生入口，由 app 的固定绑定调用。该入口负责触发判断、来源与接纳，并与手动创建入口复用同一份创建业务；SDK 通过明确的创建备份能力调用，不因本体订阅需要而开放自动事实处理入口。

备份能力处理 sessions.game.sessionEnded 时，只对已确认 exited 的真实会话考虑自动备份。在接纳新备份前，按事件中的实际 launchConfigId 读取同一启动配置当前的 auto_backup_enabled，不使用游戏启动时的旧开关，也不读取后来选中的其他首选配置。配置不存在或当前开关关闭时，不接纳新的自动备份；读取失败按失败合同报告，不能当作开关关闭。

游戏运行中修改开关，可以影响尚未接纳的退出备份。原先关闭、处理结束事实时已开启的配置，也按同一规则判断；是否存在本次合法来源仍须独立核对。备份一旦接纳，包括尚在异步准备或等待同路径执行的阶段，后续关闭开关不隐式取消、重开或改写本次操作；取消与收尾继续使用该执行自己的合同。

自动备份始终使用会话事件携带的 saveSource 快照，并明确传入 skipIfUnchanged: true。当前开关允许执行，不代表当前配置路径可以替代本次来源；本次没有来源快照时报告来源无法确定，不回退到当前路径或当前首选。实际存档字节在创建时读取，进入旧备份清理阶段再核对当前仍适用的保留规则。会话和事件不保存另一份自动备份开关，也不把接纳判断放入 bindings。

<a id="creation"></a>

## 归档与完整创建

game_save_backups 保存稳定 ID、game_id 和可空 source_config_id，以及发生时的来源路径、文件或目录种类、配置名称、创建原因、时间、备注和锁定状态。创建原因使用 manual、automatic 或 beforeRestore。

archive_attachment_id 引用应用归档。归档字节大小和校验值来自附件；tree_digest 保存[内容树摘要](#tree-digest)，unpacked_size_bytes 保存普通文件字节数之和。两者从已验证的归档取得，分别使用小写 SHA-256 十六进制文本和非负安全整数 INTEGER，不接受调用方自报的汇总值。

归档包含自足的清单与校验信息，成员路径相对于来源根。归档中的绝对路径不能决定恢复目标。来源快照不跟随配置变化，创建时间不充当主键，相同路径也不合并配置。

创建按以下顺序执行：

1. 固定来源与配置，核对游戏是否正在使用，并等待必要的写入稳定。
2. 在应用临时区读取来源并生成归档，输出不能放在来源目录内。
3. 完整验证清单、大小和校验信息。
4. 发布最终字节，通过短事务登记正式备份。
5. 登记成功后，再按适用规则清理旧备份。

符号链接、联接或不可读项目不能被悄悄跳过，也不能在未说明的情况下跟随链接后仍宣称备份完整。不支持这些内容时，操作失败。

读取过程中内容发生变化，不能登记为完整备份。普通文件复制不提供目录事务快照，因此默认在游戏停止写入后备份。ZIP 可以打开，不代表其中所有文件来自同一个游戏状态。

创建失败时保留全部旧备份，只清理本次产生的临时资源。创建成功后的淘汰失败单独报告。自动备份失败不修改已经发生的游戏使用事实。

<a id="archive-format"></a>

## ZIP 归档与版本化清单

备份保存普通文件字节、准确相对路径、目录及空目录。修改时间、创建时间、所有者、ACL、权限位、扩展属性和其他文件系统元数据不属于恢复保证，也不参与内容相等判断。恢复创建的对象采用目标环境的正常权限；ZIP 中可能存在的时间或属性字段不被当作需要恢复的指令。符号链接、联接和其他特殊对象仍按[创建规则](#creation)拒绝。

归档采用单文件 ZIP，支持 Store 与 Deflate，超过经典 ZIP 的尺寸或成员数量时使用 ZIP64；不使用加密或分卷。成员名称采用 UTF-8，非 ASCII 名称设置 ZIP 的 UTF-8 标志。格式依据为 [ZIP APPNOTE 6.3.10](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)，具体读取库由工程锁定并随制品验证。

根层只包含 manifest.json 和 content 内容范围。manifest.json 是无 BOM 的 UTF-8 JSON，形状如下：

```ts
type GameBackupArchiveEntry =
  | { path: string; type: 'directory' }
  | { path: string; type: 'file'; sizeBytes: number; sha256: string }

interface GameBackupArchiveManifest {
  format: 'kisaki-game-save'
  formatVersion: 1
  entries: readonly [GameBackupArchiveEntry, ...GameBackupArchiveEntry[]]
  treeDigest: string
}
```

entries 包含根及全部子项，path 按 UTF-8 字节升序排列且唯一。根路径为一个空字符串，必须是第一项；文件来源只有这一项，目录来源包含根目录及全部必要父目录。普通文件的 sizeBytes 是非负安全整数，sha256 是文件完整字节的小写 SHA-256 十六进制摘要；目录项不带大小或摘要。treeDigest 按下节由这些条目计算。

文件来源的根字节保存为 ZIP 成员 content；目录来源的根为 content/，其他成员按 content/ 加相对路径保存，目录成员以 / 结束。源目录中名为 manifest.json 的普通文件因此保存为 content/manifest.json。清单和 ZIP 中的类型、成员集合、展开大小及逐文件摘要必须完全对应；不能忽略额外成员或把缺项当作空文件。

相对路径使用 / 分段，非根路径没有空段、`.`、`..` 或 NUL，也不携带绝对根。文件名保留原始文字、大小写和 Unicode 组合形式，不做名称归一化或 URL 解码。归档值只作为相对成员解释；目标平台不能表示的名称、大小写或规范化冲突，均在修改用户目标前拒绝。盘符、UNC、重解析点和链接不能使读取或展开越出本次受控范围；不能调用解压器直接覆盖用户存档目录。

读取先核对格式、版本及结构，再完整验证本次恢复需要的成员。非本格式、不支持的版本、压缩或保护机制返回 UnsupportedBackupFormat；声称版本 1 而结构、成员或校验不成立时返回 DataIntegrityError；实际读取失败使用 ReadFailed。重复 JSON 键、未知版本 1 字段、重复成员及不相符的本地头／中央目录信息均不作为合法清单采用。失败保留原归档、备份记录和用户目标。

归档的版本由 manifest 拥有，不从应用版本、后缀或附件时间推断。后续版本改变格式时须说明旧格式读取或显式转换方式；普通读取不重写归档。当前恢复操作清单中的 formatVersion: 1 使用下述同一内容树摘要，不与 ZIP 的版本或压缩选项混为一项值。

<a id="tree-digest"></a>

### 内容树摘要的确定编码

摘要包含根及所有普通文件、目录，包括空目录；目标不存在使用恢复合同的 absent 分支，不为不存在构造一份空目录摘要。每项由清单转换为如下数组，按原 path 的 UTF-8 字节升序排列：

```ts
type GameBackupTreeRow =
  | readonly [path: string, type: 'directory']
  | readonly [path: string, type: 'file', sizeBytes: number, sha256: string]
```

整个行数组编码为一份无 BOM、无结尾换行、字符串外无空白的 UTF-8 JSON。整数使用最短十进制表示，零编码为 0。字符串中的引号和反斜杠使用 JSON 转义；U+0008、0009、000A、000C、000D 分别使用标准短转义，其他 U+0000–001F 使用四位小写十六进制转义，其余 Unicode 标量值直接编码为 UTF-8，斜杠不转义。正式路径不能无损表示为这些值时失败，不用替换字符改变名称。

treeDigest 是上述确切字节的 SHA-256，小写十六进制输出。它不包含 manifest 的排版、ZIP 成员顺序、压缩等级、时间、权限、备份 ID 或来源的绝对位置。同一内容改用另一种合法压缩仍具有相同 treeDigest，归档附件本身的 SHA-256 则可以不同。skipIfUnchanged、恢复前后核对和恢复 basis 使用同一树解释；源文件只改变修改时间不产生内容变化，但读取期间是否稳定仍须按创建规则核对。

<a id="retention"></a>

## 保留、锁定与删除

默认保留同一来源最近五份未锁定备份，锁定备份不计入数量。backup_retention_count 接受正整数或 NULL；界面留空保存 NULL，表示不限数量。自动备份由 auto_backup_enabled 独立控制。来源以配置、实际路径和文件或目录种类共同确定。

配置路径变化后，新来源的备份不会挤掉旧来源备份。配置已经删除，或不再对应本次来源时，不自动清理。首选变化也不能使本次操作改用其他来源或策略。

多套配置共用同一路径时，操作按实际路径串行执行，记录保留各自来源，不跨配置自动去重或淘汰。删除前重新检查锁定与占用，正在恢复或用于处理中断的材料不得清理。

取消数量上限、更换首选和刷新资料都不触发隐式删除。因此，一个游戏的总备份数量可以超过五份。

锁定阻止自动清理。手动删除锁定备份时，仍须明确展示所选记录、锁定状态与删除效果，只删除该归档和记录，不操作当前存档或整个来源目录。失败时准确保留可供后续处理的结果。

备份列表按实际时间排列，分别展示来源、创建原因、大小、备注和锁定状态，并提供打开目录与查看历史来源的入口。

<a id="restore"></a>

## 恢复目标与结果

```ts
interface GameBackupRestoreInput {
  gameId: string
  backupId: string
  target: { type: 'config'; launchConfigId: string } | { type: 'path'; path: string }
}

interface GameBackupRestoreResult {
  backupId: string
  target: {
    path: string
    kind: 'file' | 'directory'
  }
  targetState: 'restored' | 'preserved' | 'recoveryRequired' | 'keptCurrent'
  protectionBackupId: string | null
  recoveryId: string | null
  recoveryResolution: RecoveryResolution | null
  issues: GameBackupIssue[]
}
```

恢复流程由用户选择备份和当前目标，查看完整覆盖范围后确认。config 目标读取当前配置并核对游戏归属，path 目标使用明确选择的位置；即使来源配置已经删除，仍可以指定路径恢复。

两种目标都固定本次实际位置，不自动采用历史路径或后来选中的首选。文件备份恢复一个文件，目录备份替换整个目录，包括删除目标目录中归档没有的现有内容。类型不符时重新选择，不能扩大到父目录。

替换前完整准备并验证归档，拒绝越界成员、绝对路径、路径冲突和不支持的链接。还须核对目标、备份存储与工作区之间没有危险的包含关系。

游戏仍在运行或目标被占用时不执行替换。会话 interrupted 或 detached 均不证明进程已经退出，仍须检查实际实例；无法确认时要求关闭游戏。准备期间目标或配置发生变化，必须重新核对覆盖范围。

正常恢复完成返回 targetState: restored。preserved 表示目标没有修改，或已经完整回退；recoveryRequired 表示替换或回退没有安全完成，或无法确认目标状态。keptCurrent 仅由用户明确“保留现状并结束恢复”产生，表示不再改动当前目标，不证明它等于所选备份或原存档。这些值不能根据任务终态推断。

失败或取消时，如果已经形成合法结果，通过 `ExecutionFailure<GameBackupRestoreResult>.partialResult` 返回；准备阶段尚未形成结果时不能伪造报告。protectionBackupId 指向锁定的保护备份，原本没有目标时可以为空。recoveryId 用于定位备份模块自己的恢复材料，不依赖任务历史。 recoveryId 为空时 recoveryResolution 也为空；ID 非空且 resolution 为 null 表示仍需处理，非空 resolution 表示已经处理但尚有材料或清理结果。调用方不必借任务终态猜测这一区别。

替换前收到取消，停止后续工作。关键替换已经开始后，先完成当前安全步骤或回退，再响应取消。如果目标与完成事实都已经确认，只是多余临时资源清理失败，可以成功返回并附 issues；尚未解决的恢复材料必须继续保留。

<a id="protection"></a>

## 保护备份与安全替换

用户确认后，先为当前目标创建并锁定 beforeRestore 保护备份。保护失败时不得替换。目标原本不存在时如实记录，不能伪造一份空旧存档。

新内容与替换工作区放在目标所在文件系统的受控位置。操作先保留能够恢复的原目标副本，再把完整准备好的内容放入最终目标。不能边解压边覆盖，也不能先清空目标再准备内容。

替换失败时，只有能够确认原目标和回退材料未被外部修改，才执行撤回。无法安全撤回时，保留原副本、新内容与说明，并显示待处理状态，不能删除唯一可恢复的数据。文件移动、复制与数据库提交不共享原子事务，恢复流程必须处理它们分别完成的情况。

恢复成功后，锁定的保护备份继续保留，用户仍可恢复原状态。只有新目标、保护备份和完成结果都已经确认，才清理临时旧副本。恢复只改变存档，不回退评分、当前状态、完成历史、补记时长或已有活动。

<a id="recovery"></a>

## 恢复记录与实际磁盘状态

恢复的可继续性由不可变操作清单、可发现索引和实际字节共同确定。阶段只提示已经尝试过什么，不能单独决定下一步。没有发生替换且目标内容已与所选备份相同时，可以核验后直接返回 restored；原保护备份继续保留，不为了同样内容再移动目录。

### 索引与工作区

本体表 game_backup_recoveries 保存 id、game_id、backup_id、可空 protection_backup_id、target_path、target_kind、workspace_path、manifest_sha256、created_at、可空 resolution 和 resolved_at。resolution 为 NULL 表示尚未处理完，其他值为 restored、rolledBack 或 keptCurrent，并必须同时具有 resolved_at。game_id、备份引用与路径均来自本次实际操作；存在恢复引用时限制相关正式对象和备份删除，不依赖 TaskRun 的保留。

id 使用 TEXT 主键；三个正式引用使用 TEXT 外键并限制删除，protection_backup_id 可空。两个路径使用非空 TEXT，workspace_path 还须唯一；target_kind 使用 file／directory CHECK。manifest_sha256 是非空的 SHA-256 十六进制文本。created_at、resolved_at 使用 UTC 毫秒 INTEGER；resolution 的允许值与 resolved_at 的共同空值关系由 CHECK 约束。目标路径的实际等价与相交关系仍使用 holdings 的文件系统规则，不能只依赖字符串唯一约束。

索引只保存发现、归属与最终处理事实；临时准备和文件移动阶段不在数据库中另存一份。工作区位于目标所在文件系统、目标范围之外，由本体创建唯一目录并在索引记录准确位置。其固定子路径为 manifest.json、progress.json、prepared、original 和 displaced；输入和归档不能选择这些位置。应用只排除索引中实际拥有的工作区，不按相似目录名猜测归属；scanner 与 holdings 不将这些工作区纳入普通发现。 备份拥有者提供只读的路径归属判断，由 app 装配给发现能力；文件设施不反向读取业务表，scanner 不导入备份私有实现。

manifest.json 使用 UTF-8 保存以下不可变信息，发布后不原位修改：

```ts
interface GameBackupRecoveryManifest {
  formatVersion: 1
  recoveryId: string
  gameId: string
  backupId: string
  protectionBackupId: string | null
  target: { path: string; kind: 'file' | 'directory' }
  before: { type: 'absent' } | { type: 'present'; treeDigest: string }
  after: { treeDigest: string }
  createdAt: number
}
```

manifest_sha256 校验清单的实际文件字节，索引身份、目标和备份引用须与清单一致。before／after 的 treeDigest 与[归档内容树摘要](#tree-digest)使用同一字段、顺序与确定编码；检查磁盘时由实际文件及目录重新形成这些行。文件与目录、空目录与目标不存在分别表达。链接、不可读成员、路径冲突和读取中变化按归档规则拒绝，不生成看似完整的摘要。

progress.json 只含 recoveryId、非负单调 sequence 和 phase，phase 为 ready、originalPreserved、replacementPlaced 或 rollbackStarted。更新先写本工作区的独立临时文件并刷盘，再替换进度文件；缺失、损坏或落后时仍按清单与磁盘重新判定。它不授权删除任何材料，也不作为来源内容的凭据。

### 写入与替换顺序

1. 固定目标和来源，完整准备 prepared，校验内容及摘要；目标存在时完成已锁定的 beforeRestore 备份，并确认它对应 before。目标变化时重新准备或失败，不偷偷采用新的覆盖范围。
2. 发布并刷盘不可变清单，保存可发现索引与 ready 进度。两者完成后才允许修改目标；任一失败均不开始替换。
3. 再核对目标、进程占用、路径关系与清单依据。目标原本存在时，将它移动到 original，确认保留内容仍与 before 相符，再记录 originalPreserved。原本不存在时仍确认目标为空缺。
4. 将完整 prepared 移到当前为空缺的目标位置，确认目标与 after 相符，再记录 replacementPlaced。步骤不使用跨文件系统的复制后删除，也不覆盖突然出现的新目标。所有目标与恢复材料之间的移动都通过[本体 moveNoReplace](../engineering/native.md#files)完成；原生拒绝已有目标，不能用 Node rename 或先检查再覆盖实现。
5. 在短事务中将索引 resolution 置为 restored，记录完成时间并形成真实结果。数据库提交失败时保留索引和全部材料，后续继续只核验并补完结果，不再次覆盖已放入的新目标。
6. 只有目标、锁定保护备份和完成记录均已确认，才清理本体多余材料。清理失败返回问题并保留索引；材料全部清理成功后才删除恢复索引。保护备份不随工作区清理删除。

关键文件发布、移动后的目录元数据和索引提交按下述[持久化次序](#durability)完成。数据库采用[既定同步配置](../engineering/database.md#integrity)，文件与命名空间分别完成自己的同步步骤；writeFile 或普通 rename 返回不构成跨数据库和文件系统事务。

同文件系统也不代表外部程序不能改变目标。每次执行和清理仍核对实际状态；无法满足安全前提时保留材料。相关平台依据见 [Node 文件系统](https://nodejs.org/api/fs.html)、[Windows 目录移动](https://learn.microsoft.com/en-us/windows/win32/fileio/moving-directories)与 [SQLite 原子提交](https://www.sqlite.org/atomiccommit.html)。

<a id="durability"></a>

### 文件、目录项与索引的持久化次序

文件设施拥有归档、prepared、恢复清单及进度文件的写入与发布。完整写入并验证普通文件后，通过[原生 syncFile](../engineering/native.md#file-sync)确认该文件的同步；必要同步失败时不将该准备结果交给后续目标修改。完整保护归档及其正式登记也必须先完成，才允许替换用户目标。

Windows 的关键新文件先写入本体拥有的独立临时路径，完成文件同步后，通过 moveNoReplace 及 MOVEFILE_WRITE_THROUGH 发布到尚不存在的位置；目标与恢复材料之间的目录移动使用同一原语。Windows 的发布采用这些机制，不追加需要管理员权限的整卷刷新，也不把打开目录句柄视为已经执行了目录同步。

macOS 与 Linux 在准备树形成后同步各层目录，按由内到外的次序完成；新增或移动后同步受影响的父目录，跨目录移动包含来源父目录和目标父目录。同一目录只需完成当前阶段的一次同步。macOS 在命名空间同步后，再对同一工作区中已写入的清单文件执行 F_FULLFSYNC，使关键发布屏障使用对应设备；其他卷上的保护归档和数据库按自己的同步配置完成。目录同步失败按该阶段失败处理，不将文件数据同步代替它。

不可变清单及可发现索引成功后才移动旧目标。新目标就位并完成适用同步后，才将恢复索引标为 restored；持久化失败发生在目标修改之后时，保留索引和所有保护材料，返回实际失败并由 inspect 重新核对磁盘。progress 只是提示，更新失败不授权覆盖、清理或重新执行已经完成的移动。

正式验证分别记录文件系统、挂载方式、权限、同步返回、移动与数据库次序，以及进程终止、系统崩溃或断电的实际执行范围。[Linux 目录同步](https://man7.org/linux/man-pages/man2/fsync.2.html)、[Apple 的写入顺序说明](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fsync.2.html)及[Windows 移动标志](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)各支持其平台机制，不能合并为任意设备上的掉电保证。Windows 的目录发布、必要空目录和清单耐久性须在实际目标文件系统上验证；进程中断与掉电分别形成证据。

### 中断后的判定

下表中 B 表示清单的 before 内容，N 表示 after 内容，空缺表示路径确实不存在。摘要相等仍须同时满足类型、路径及可读取性检查。before 与 after 相同的操作在替换前结束，不进入此表。

| 目标                                                     | original             | 新内容位置                 | 可以继续什么                                                         |
| -------------------------------------------------------- | -------------------- | -------------------------- | -------------------------------------------------------------------- |
| B                                                        | 空缺                 | prepared 为 N              | 继续：保留 B 后放入 N；撤回：确认目标未变并记 rolledBack             |
| 空缺                                                     | B                    | prepared 为 N              | 继续：放入 N；撤回：将 B 放回空缺目标                                |
| N                                                        | B                    | prepared 空缺              | 继续：核验并完成数据库结果；撤回：先将 N 移到 displaced，再将 B 放回 |
| 空缺                                                     | B                    | displaced 为 N             | 继续：将 displaced 放回目标；撤回：将 B 放回目标                     |
| B                                                        | 空缺                 | displaced 为 N             | 继续：重新保留 B 后放入 N；撤回：核验并完成 rolledBack               |
| 空缺，before 原本不存在                                  | 空缺                 | prepared 或 displaced 为 N | 继续：放入 N；撤回：保持目标空缺并完成 rolledBack                    |
| N，before 原本不存在                                     | 空缺                 | prepared 空缺              | 继续：完成 restored；撤回：将 N 移到 displaced，保持目标空缺         |
| 目标已为 B，或 before 与目标均为空缺                     | 没有与清单矛盾的材料 | 新内容缺失                 | 只可核验后完成撤回，不声称仍可继续恢复                               |
| 任一必要位置不可读、内容不符、出现额外目标或材料归属不明 | 保留实际状态         | 保留实际状态               | 不自动移动或清理；可再次核对，或明确保留现状并结束处理               |

original 或新内容移动的系统调用已经成功、进度尚未更新时，按实际位置进入相应行。撤回同样分成“移开已经放入的新内容”和“恢复原目标”两步，每步前后记录进度并核验；中断后重新判定，不按旧阶段重复覆盖。before 原本为空缺时，撤回只把本次新内容移入工作区，不能递归删除后来出现的其他内容。

### 检查、继续、撤回与保留现状

library.holdings.backups.recoveries 提供以下明确方法。恢复与撤回继续使用原生覆盖范围确认和共同执行上下文；仅检查不改变目标。

| 方法                                                 | 输入及结果                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| list({ gameId?, state?, offset, limit })             | state 为 pending 或 resolved，可省略；按 createdAt、id 倒序返回有界摘要与 total。只读取索引，不为了显示列表遍历存档字节。                                               |
| get(recoveryId)                                      | 返回完整索引及清单可读状态；不存在为 null，不代替实际内容核验。                                                                                                         |
| inspect(recoveryId)                                  | 返回目标与三处材料的实际观察、允许的 continue／rollback／keepCurrent 动作、问题和 basis。basis 是本次索引、清单和观察摘要的确定编码摘要，既不是持久版本也不是操作授权。 |
| resolve({ recoveryId, action, expected: { basis } }) | action 为 continue、rollback 或 keepCurrent；重新检查索引、材料和 basis，一次明确执行后返回 GameBackupRestoreResult。                                                   |
| remove(recoveryId)                                   | 只接受已经 resolved 的索引，经明确清理选择后删除本体恢复材料并最后移除索引，返回 void；不存在时幂等完成。保护备份仍保留。                                               |

list 的 offset 必须为非负安全整数，limit 为 1–200 的整数，均由调用方明确提供；gameId 存在时核对真实游戏归属，失效目标为 NotFound。返回值为 `{ items, total }`，同次读取使用相同条件。

inspect 的结果为以下只读结构，文件树全文不经过普通界面或日志：

```ts
type RecoveryLocation = 'target' | 'original' | 'prepared' | 'displaced'
type RecoveryAction = 'continue' | 'rollback' | 'keepCurrent'
type RecoveryResolution = 'restored' | 'rolledBack' | 'keptCurrent'

type RecoveryLocationObservation =
  | { status: 'absent' }
  | { status: 'readable'; kind: 'file' | 'directory'; treeDigest: string }
  | { status: 'unavailable'; error: ErrorSummary }

interface GameBackupRecoveryInspection {
  recoveryId: string
  resolution: RecoveryResolution | null
  manifest: GameBackupRecoveryManifest | null
  locations: Record<RecoveryLocation, RecoveryLocationObservation>
  actions: readonly RecoveryAction[]
  issues: readonly {
    location: RecoveryLocation | 'manifest' | 'index'
    error: ErrorSummary
  }[]
  basis: string
}
```

清单无法验证时 manifest 为 null，保留具体问题；已结束索引的 actions 为空。basis 对索引身份、处理结果、清单实际摘要及四处观察作确定编码后计算 SHA-256；不可读位置使用稳定错误 code，不使用错误文案或观察时间生成无意义冲突。resolve 重新生成同一依据再比较，不信任客户端传来的 actions。keepCurrent 不读取清单中的路径执行文件动作，清单损坏不阻止用户保留现状。

继续、撤回和清理材料均须明确的原生确认；SDK 只能沿相同完整入口与交互条件调用，后台不代替用户选择。检查接口本身不触发这些动作。

resolve 对同一目标及相交范围串行执行，只接纳 pending 索引。重复调用等待正在执行的结果；已经 resolved 时返回 AlreadyResolved，由调用方读取处理结果。

检查依据变化返回 Conflict，其他正在执行的操作返回 Busy，索引不存在返回 NotFound，目标被使用返回 InUse，材料或路径无法确认返回 RecoveryUnverifiable。失败或取消的 partialResult 保留已知目标状态、recoveryId 与 recoveryResolution。

处理记录保存失败使用 RecoveryCommitFailed：目标已确认为 N 时可以返回 restored，recoveryResolution 保持 null；目标确认为 B，或原本不存在且仍为空缺时返回 preserved；移动中间态或无法核实时返回 recoveryRequired。keepCurrent 仅在其数据库处理记录保存成功后返回 keptCurrent。

keepCurrent 只把索引记为 keptCurrent，保留目标、original、prepared、displaced 和保护备份的全部现状，解除该索引对目标启动及后续恢复的阻挡。界面展示当前目标是否存在、是否可核实，并明确这不是恢复成功；该动作不要求目标恰好等于 B 或 N。正在执行恢复时不能接受它。材料缺失或清单不可读仍如实保留问题，不能因此静默删除索引或材料。

完成撤回时记 rolledBack，结果为 preserved；它不回滚已经保存的任务、活动或个人记录。成功后多余材料的清理只处理能够从清单和归档确认的本体内容。清理中断后可以继续删除剩余、仍匹配的材料；出现额外或被修改内容时停止并保留。删除工作区前检查其解析后的绝对路径、所属 recoveryId 以及全部剩余成员，不能将未核实的用户目录交给递归删除。

重启只读取索引并显示待处理项，不自动继续、撤回或保留现状。pending 阻止冲突范围的恢复、清理与应用内启动，resolved 不再阻挡。清理任务历史不删除恢复材料；资料根恢复后找不到外部工作区时显示材料不可用，由用户明确处理。

<a id="recovery-verification"></a>

### 验证范围

以真实临时文件分别覆盖文件与目录、原目标存在或为空缺，在清单／索引建立、旧目标移走、新目标就位、数据库完成和撤回两步的前后中断。重新打开后依据实际字节验证继续与撤回，不仅检查阶段字段。另验证目标被外部改写、进度落后、材料丢失、取消、空间或权限失败、相交范围互斥，以及 keepCurrent 保留全部字节并解除阻挡。

正常归档、锁定保留、自动备份去重与来源变化仍按前文验收。进程故障注入、数据库重开与实际掉电的证据分别记录；未运行的平台和文件系统保持未验证，不能用一条正常恢复替代这些边界。
