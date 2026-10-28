# 普通写入的基线与失败目录

本页补充[完整操作](library-operations.md)的公共边界，定义普通编辑允许的 expected、关联与排列输入，以及可供程序分类的错误。各领域分别定义字段值域、归属、资源和完整操作，共同形成明确的公开调用目录。

<a id="expected"></a>

## expected 的允许范围

普通 update 采用 `(target, { changes, expected? })`。target 使用所属 ID 或正式 Ref；changes 与 expected 是按操作及对象类型定义的闭合类型，均严格拒绝未知键。空 changes 可以作为无变化成功，不能借只传 expected 执行其他行为。expected 不自动从 changes、updatedAt 或完整详情推导。

独立字段仅允许比较本次修改的同名原值。紧密关联的值组，以及下表明确列出的上下文，可以在没有同名写入时比较。字段缺席表示没有该条件，null 只用于正式允许为空的原值；不能提交 undefined 或 JSON 路径。普通表单必须提供本次保存单位的完整基线，接口允许省略只为明确的即时设置，不把无基线保存展示为已经受并发保护。

| 操作                                                             | expected 的闭合范围与比较单位                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| entries.update 的共同资料                                        | name、originalName、sortName、aliases、description、primaryImageId、externalLinks、isNsfw、addedDate；独立标量分别比较，日期、数组、正文各是完整值                                    |
| entries.update 的作品资料                                        | releaseDate、originalLanguages、backdropImageId、titleLogoId；游戏另有 iconImageId；其他专属字段按[正式类型表](catalog.md#work-fields)以 camelCase 同名字段逐项限定                   |
| entries.update 的角色／人物／组织资料                            | [正式资料](catalog.md#characters)中适用字段的 camelCase 名称；每个 number/text 身体资料值整体比较，日期整体比较，不开放日期分量 patch                                                 |
| entries.update 的评价与当前记录                                  | evaluation 只含 rating、favorite；record 只含 Work 的 status、additionalDurationMs，各自比较实际修改项；缺行分别读取 null／false／null／0                                             |
| entries.update 的外部身份                                        | externalIdentities 为该条目的完整身份集合，按 source 与完整 sourceId 比较，不按数组顺序；增减显式身份仍核对全库唯一性                                                                 |
| entries.update 中的标签／手动合集关联                            | 只有 replace 分支接受 expected.tags／expected.collections，标签比较该侧完整成员、关系属性及顺序，合集只比较完整成员及备注；modify 分支不接受这两个整体基线                            |
| entries.setEvaluation                                            | 仅 rating、favorite 中本次修改的项；参数为 `(ref, { changes, expected? })`，不重复 evaluation 外层                                                                                    |
| entries.setWorkStatus                                            | `(work, { status, expected?: { status } })`；只允许三种状态或 null                                                                                                                    |
| parts.update                                                     | 该 Part 正式可编辑资料的同名原值，含完整外部身份集合；不含 id、PartRef.type、work、创建时间、顺序或派生数量；动画业务分类 type 仍属可编辑资料；completed 使用明确设置接口             |
| parts.setCompleted／setCompletedMany                             | 明确 PartRef 或非空去重 PartRef 数组及 completed 布尔值；即时设置不接受 expected，不修改作品完成历史                                                                                  |
| parts.changeKind                                                 | 原 PartRef 固定原种类；target 给出目标 kind、type 与适用 numberLabel，changes 提交共同资料，expected 只比较实际修改或移除的原字段；不接受整行基线                                     |
| completions.create／createMany／recordCurrent／recordCurrentMany | 只允许目标作品的 completionCount；其原子性与批量规则见[完成记录](records.md#creation-baseline)                                                                                        |
| completions.update                                               | `(work, completionId, { changes, expected? })`；仅 completedDate、note 的相关原值                                                                                                     |
| relations.*.update                                               | expected.binding 为该类关系的完整事实端点与角色／职责／类型组；另允许 note、isSpoiler 的相关原值。表单保存总带 binding，避免将原事实的说明写给已经更换端点或职责的事实                |
| collections.update                                               | name、description、primaryImageId、isNsfw 各自比较；dynamicRules 整体比较规则、保存排序与引用名称快照；模式不可通过普通 update 修改                                                   |
| collections.convertToManual                                      | `(id, { expected: { dynamicRules } })`，完整原规则必填；当前仍为动态模式是业务前提。返回 void，按完整资料求值与转换，不采用普通可见性过滤                                             |
| tags.update                                                      | 仅 name、description、isNsfw，各自比较；没有封面、命名空间或全局人工顺序                                                                                                              |
| notes.update                                                     | title、content、primaryImageId 各自比较；entries 是笔记这一侧的完整有序 EntryRef 数组，仅实际替换关联时比较                                                                           |
| annotations.update                                               | title、content 各自比较；expected.target 比较所属标注的完整 fileId／location／quote／imageId 组合，只包含该媒介适用成员；修改任一目标成员时带整个 target 基线                         |
| activities.update                                                | expected.activity 比较 startedAt、endedAt、durationMs 及该媒介实际上下文的完整值；时间、有效时长与上下文为同一保存单位，不用创建／修改时间替代                                        |
| holdings 的目录、启动配置、识别方案编辑                          | 名称等独立资料按同名原值；路径、配置 definition、方案 definition 各自整体比较；文件观察、可用性与技术探测不是用户 expected                                                            |
| holdings.files 的关联采用                                        | expected.associations 为完整 Part 关联及其属性／顺序，expected.associationMode 为原模式；两者共同核对，manual 空数组仍是正式选择                                                      |
| holdings.files.setAssociationMode                                | 仅 associationMode；完整输入沿用[关联方式](holdings.md#association-mode)                                                                                                              |
| 文件／分部首选设置                                               | 只比较对应明确 Work 或 Part 范围的 preferredFileId（ID 或 null）；批量每项有自己的范围，不能比较其他范围首选                                                                          |
| 备份备注修改                                                     | 只比较 note；lock／unlock 是当前意图，不接受快照。恢复处理使用独立 inspect basis，不套用普通字段 expected                                                                             |
| metadata.profiles、scanner.configs、文件识别方案                 | 名称和其他可编辑独立字段分别比较，definition 整体比较；MetadataProfile 设置 isDefault: true 另允许 defaultProfileId，见[默认方案](metadata-profiles.md)                               |
| preferences.update                                               | 只允许本次修改的正式配置字段；数组、选择引用和完整凭据按[偏好合同](preferences.md)作为相应单位，凭据只比较读取状态／revision                                                          |
| showcase.applyChanges                                            | 修改项只比较 name、query、layout、itemSize、limit、openMode、isVisible 的实际修改项，query 整体比较；表单删除按本区块完整原配置比较，最终排列核对完整原顺序，不能把可见区块片段当全集 |
| appearance 的主题保存与选用                                      | 名称与分支 token 按实际修改比较，整体替换分支时比较该分支完整原值；条件选用只比较正式主题选择引用。保存成功但选用失败保留已保存主题                                                  |

外部身份、标签、手动合集等集合的“完整”，指该编辑范围的正式事实，包含普通隐藏的关联；普通列表片段、搜索结果和读到的一页不能作为替换基线。没有编辑这些集合时，不要求查询它们，也不阻止其他字段保存。

正文携带的附件引用由完整正文与准备结果核对并同次维护。expected.description／content 比较正式正文，不允许调用者再加一份可独立覆盖的附件关系条件。图片基线使用已保存附件 ID；新图输入仍遵守资源准备合同，不能借 ID 比较跳过采用校验。

关系 binding 的确切成员如下；所有 Ref 使用正式类型，nullable character 保留 null，不省略：

| 关系              | binding                                                          |
| ----------------- | ---------------------------------------------------------------- |
| workCharacters    | `{ work, character, role }`，role 可空                           |
| personWorks       | `{ work, person, character, role }`，character 可空              |
| organizationWorks | `{ work, organization, role }`                                   |
| workRelations     | `{ from, to, type }`，使用正式存储方向；反向编辑先转换为同一方向 |

annotations 的 target 将需要共同核对的字段组成一个比较单位。修改标题只比较标题所需基线；重新选择目标时，同时核对旧位置、摘录、画面及文件，并按[内容目标规则](annotations.md#api)替换或保留对应值。标注身份和所属 work 保持原样。

activities 的时间区间与真实上下文共同决定这条事实描述哪次活动，因此整组核对。会话写入和最终快照重试使用会话已有的运行顺序及保存基线，不通过普通补录接口绕过这些约束。

create 默认不接收 expected；完成记录数量、默认 MetadataProfile 与引导采用是各自明确的例外。除 showcase 表单删除的明确原配置外，delete 不接收 expected；merge、bind／unbind 外部身份、即时增减成员、运行控制和普通读取不接受通用 expected。writeGraph 的普通更新复用本表相应合同；[关系范围采用](library-graph-contracts.md#relations)另外只核对本次明确删除的完整关系快照，修改项仍使用相应 update.expected，不追加图级 revision，也不把其他图节点的任意字段变成条件。

<a id="membership"></a>

## 关联修改与排列的输入

Entry 中的标签关联值为 `{ tagId, note, isSpoiler }`，手动合集关联值为 `{ collectionId, note }`；标签数组顺序表示当前 Entry 这一侧的顺序；条目的合集集合不具有独立排列，展示始终沿用合集全局顺序。空备注为 null。初始创建可以省略 note／isSpoiler，分别采用 null／false；已保存值与 expected 使用完整形状。合集成员侧使用 `{ entry: EntryRef, note }`，标签应用侧使用 `{ entry: EntryRef, note, isSpoiler }`。

```ts
type MembershipChange<Member, Identity> =
  | { type: 'replace'; items: readonly Member[] }
  | { type: 'modify'; add?: readonly Member[]; remove?: readonly Identity[] }
```

这是形状说明，正式 tags、collections、notes 和文件关联分别使用自己的闭合成员类型，不导出可套在任意关系上的万能写入接口。modify 至少提供一个非空数组，add 与 remove 不得包含同一身份，各数组不得重复真实身份；重复或矛盾返回 InvalidInput。追加已经存在的身份保留现有属性与位置，移除已经没有的关联为无变化成功；端点自身不存在仍是 InvalidReference。修改已存在的备注或剧透使用属性编辑，不借重复 add 覆盖。

replace 完整采用所属侧的成员、属性及该侧确实存在的顺序；对端已有排列保持，新关系追加到对端末尾。条目侧的合集 replace 不采用数组顺序，也不重排合集全局列表。表单替换必须带完整原成员基线，公开操作可以为明确的全量设置省略 expected，但不能因此跳过完整范围与约束校验。动态合集不能调用成员写入；转换先使用[模式转换](collections-and-tags.md#manual)。成员操作分别为 collections.members、tags.entries、notes.entries；Entry 侧通过 entries.update 同次保存，不能先调用这些接口落一半草稿。

人工排列使用 `reorder(scope, { order, expected: { order: completeOriginalOrder } })`。order 为非空、无重复的实际身份数组，至少两项才有顺序变化；scope 明确当前一侧的拥有者与关系种类。completeOriginalOrder 必须包含该侧的完整原成员与顺序。order 是全集时替换完整排列；是子集时只置换这些成员原来占据的位置，保留其余成员所在槽位。参与排列的成员缺失、范围改变或原顺序不同均为 Conflict，不缩小目标集合。

独立的即时移动使用 `move(scope, { ids, before })`，ids 为非空去重身份数组，按输入顺序移动为一段；before 为同一完整范围中的非选中身份或 null（末尾）。它依据提交时当前顺序表达位置意图，不接收 expected，不把过滤后的相邻像素位置当作锚点。before 或被移动目标失效时失败，不能自动追加到尾部。界面必须处于该侧人工排序才能发起这项动作。

每个接口通过类型化引用限定 scope 的实际拥有者。资料关系使用真实关系 id，并明确 work／character／person／organization／from／to 侧；Note 使用 note 或 EntryRef 侧；合集全局顺序无需 scope 参数，合集成员使用 collectionId。条目侧的合集排列与标签全局排列不提供 reorder／move。Part 排列使用真实作品及适用 Part 种类，漫画卷话收录使用真实联合身份；汇总行中的人物或角色引用仍只标识其主体。

上述排列与关联修改在同一短事务中核对并完整提交，成功返回 void。需要与其他草稿共同保存时，使用所属完整 update 或图提交，将这次修改作为一个业务操作完成。

<a id="errors"></a>

## 共同与领域错误目录

ErrorSummary.code 的传输类型保留 string，以便同一通信机制承载本体和明确的扩展私有错误；这不允许本体调用临时创造同义错误码。本体各合同引用下列命名，并在对应公共包声明闭合常量联合。调用方只对自己认识的 code 分支；未知但结构合法的安全错误按普通失败显示，不猜重试，不丢弃合法 partialResult。

| code               | 语义与处理边界                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| InvalidInput       | 输入形状、值域、未知字段、空操作数或相互矛盾的参数非法                                                                                      |
| NotFound           | 必须修改或控制的明确主体已不存在；普通 get 未匹配仍返回 null                                                                                |
| InvalidReference   | 引用种类、归属或当前引用目标不合法；不以此暴露普通隐藏                                                                                      |
| Conflict           | 声明的字段／集合基线或唯一性等提交约束不满足；保留草稿，由用户重新核对                                                                      |
| TargetChanged      | 异步准备采用的实际目标或资源依据变化，原准备结果不可继续采用；不作为普通字段 Conflict 的别名                                                |
| InUse              | 受影响的真实 Work／Part／文件／配置仍被使用，先结束相关会话                                                                                 |
| Busy               | 操作合同不允许同时进行的运行已存在；只有明确允许的等待入口可以复用等待                                                                      |
| ResourceLimit      | 所属操作的行数、字节、解码或在途资源预算不足；按[容量边界](../engineering/performance.md#results)拒绝接纳或结束后续工作，保留已经成立的事实 |
| PermissionDenied   | 真实调用入口没有该项能力，不以业务参数扩大开放范围                                                                                          |
| Cancelled          | 执行者已经按取消合同结束本次操作，可能保留合法 partialResult；不是未写入证明                                                                |
| ConnectionClosed   | 当前连接无法继续交付结果；已发出的写入结果可能未知，不自动重放                                                                              |
| InstanceExpired    | 所属扩展／窗口／文档运行实例已经失效，旧句柄不能进入新实例                                                                                  |
| DataIntegrityError | 必要结构或正式引用损坏，不能按空库、缺省值或不存在继续处理                                                                                  |
| ReadFailed         | 读取自身失败，安全说明由拥有者提供                                                                                                          |
| WriteFailed        | 普通持久提交失败且没有更具体的领域分类；事务回滚范围按完整操作定义                                                                          |
| OperationFailed    | 非读写步骤的执行失败且不属于下表更具体分类；原始 cause 留在拥有边界                                                                         |

| 拥有领域   | 额外 code 与明确含义                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry 查询 | InvalidQuery：保存规则非法；SelectionChanged：稳定选区上下文失效；见[查询失败](library-query-contracts.md#errors)                                          |
| 合集       | UnsupportedMembershipMode：操作不支持当前手动／动态模式，不暗中转换                                                                                        |
| 持有与路径 | FileUnavailable：所需内容不可访问；PathUnresolved：无法可靠判断实际位置关系；PathConflict：确认违反位置唯一或范围约束                                      |
| 游戏启动 | GameLaunchUnconfirmed：系统已接受启动请求，但运行确认失败且未建立会话；可能已有外部程序运行，不返回部分 GameSession，不自动重试。主动取消或调用归属失效保留相应原分类。 |
| 最终记录   | RecordingSaveFailed：已结束内容仍有待保存事实；PendingRecording：身份变更被待保存引用阻止；PositionSuperseded：旧位置失去写入资格                          |
| 播放设置   | PlaybackApplyFailed：所选设置已保存，但当前执行者未能采用；partialResult 为完整 PlaybackSettingResult，见[保存与采用](sessions.md#playback-setting-result) |
| 内容采集   | CaptureUnavailable：未取得符合本次采集合同的画面，包括不能确认所需 SDR 路径；不返回 PreparedImage，不自动换目标或重试                                      |
| 存档与恢复   | UnsupportedBackupFormat：归档格式、版本、压缩或保护机制不在支持范围；RecoveryUnverifiable：当前材料或目标无法可靠判定；RecoveryCommitFailed：目标处理与索引提交未共同收尾；AlreadyResolved：恢复索引已经处理，读取其实际结果    |
| 凭据保护   | CredentialProtectionUnavailable：当前系统保护能力不可用；CredentialUnreadable：已存密文无法读取。均保留原凭据，与真实未配置和远端认证失效分开。            |
| 协议接入   | ProtocolMismatch：帧版本／配置不匹配；ApiIncompatible：正式 API 兼容范围不满足；ProtocolViolation：非法帧或非法消息顺序；PayloadTooLarge：超过明确传输容量 |

上述领域错误目录定义本体失败分支。来源、安装、更新等正常逐项 issues 仍使用所属业务结果的判别值，不把每个结果分支都提升为异常；没有细分合同的整体失败使用 OperationFailed，不能靠底层库 error.message 生成新 code。独立项目的 MpvError 等保留其自身体系，在本体拥有边界转换，不把第三方所有错误码放进桌面联合。

失败结果的 code、message、partialResult 按[共同失败合同](../communication.md#failure)传递；不增加任意 details、retryable 或“强制保存”开关。需要让程序处理逐项上下文时，由所属业务的合法结果／issues 定义明确字段。没有合法结果的普通原子写入不带 partialResult，不能把半份请求装成成功内容。

文件切换沿[FileSwitchResult](sessions.md#switch)交付阶段事实：尚未离开原文件的失败不带部分结果；原内容已经结束时，失败携带 previousEnded。错误码仍表达实际原因，例如 RecordingSaveFailed、FileUnavailable、ReadFailed 或 Cancelled。previousEnded 不代替这些分类，也不承诺记录和资源已经全部收尾。

输入形状与调用权限在接纳前检查；事务中按目标、必要引用、使用占用与提交基线核对。多个错误同时存在时不承诺全局优先级，调用者不得用先遇到哪种错误探测隐藏资料。相同具体失败不能在 IPC、SDK 和原生调用中改成不同的业务 code。

<a id="verification"></a>

## 类型与运行验证

公共包的类型与运行校验覆盖表单正常保存与未知 expected 键、非 Work record、无关字段条件、错误关系 binding、局部关联假装完整基线等拒绝样例。数据库接入在真实短事务中验证：不同字段并发保存可共存，同字段／相关值组冲突不留下部分修改，排序只改变指定侧，显式重复增减保持幂等边界。

公共操作按上述目录声明比较单位与错误分支。需要增加分支时，先更新所属合同与样例；内部 helper 按实际职责安排。公共基线只接受合同明确允许的事实，不接受 `Record<string, unknown>`、任意 SQL 条件或整行时间戳。
