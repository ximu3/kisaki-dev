# 作品使用会话

sessions 管理一次实际游玩、播放或阅读。它确定目标，协调内容执行与使用界面，观察有效使用，保存可信事实，并完成结束和资源释放。正式资料、个人记录和历史仍由 library 管理。

<a id="ownership"></a>

## 产品会话与记录归属

产品会话按四类 Work 区分。实际使用目标是本次确认的游戏受管理运行，或本次打开的真实文件。游戏会话可以观察一个进程集合，不以某个主进程作为会话身份。

```ts
type WorkSession = GameSession | AnimeSession | ComicSession | NovelSession
```

| 产品会话     | 明确的产品归属与实际目标                 | 使用界面     |
| ------------ | ---------------------------------------- | ------------ |
| GameSession  | 游戏、实际采用的启动配置及本次受管理运行 | 游戏使用面板 |
| AnimeSession | 动画作品及实际视频文件                   | 播放器       |
| ComicSession | 漫画作品及实际阅读文件                   | 阅读器       |
| NovelSession | 小说作品及实际阅读文件                   | 阅读器       |

每个实际使用上下文使用唯一 sessionId，各类会话通过 WorkSession 联合类型交付。阅读器、播放器和进程观察句柄归所属会话持有。漫画与小说共用阅读能力，分别按作品保存记录；切换到另一实际文件时更换会话，EPUB 内部章节切换保持同一文档和会话。

library 管理当前评价、作品状态、完成声明、活动、位置和 Annotation。[活动补录与修正](library-operations.md#activities)由 library.activities 直接保存；迁移的逐次完成历史通过 library.completions.create / createMany 保存。上述操作修改各自明确提供的事实，其他历史、状态和笔记保持独立。来源快照的历史初始化与当前值采用遵守[来源采用合同](records.md#imports)。

sessions 只采用实际观察到的事实。保存检查点更新对应活动的绝对累计时长及本次已确认的文件位置；作品总时长与最近使用由正式活动和附加时长按[查询口径](library-queries.md#activity-statistics)取得，不由会话维护另一份可独立修改的汇总。异常退出时保留已提交部分，不用重新启动的时刻补算中断时间。

逐次完成记录属于作品，真实分部只保存完成标记，位置属于实际文件。更换首选文件、重新绑定或文件失联，都不能把旧文件坐标移给新文件。解绑保留合同要求的历史上下文，正式删除遵守资料库的完整删除范围。位置、选区、页面区域和摘录分别见[阅读定位](reader.md)与 [Annotation](annotations.md)。Kana 负责格式解释和内容映射，不读取 Work、Part 或本体数据库；Kisaki 通过公开 npm 包接入。

一次完整会话依次经历目标选择、占用登记、执行者打开、就绪确认、使用观察、library 保存、结束和释放。生命周期由 sessions 协调，不散落在组件卸载回调中。运行进度变化也不触发整份资料详情重载。

<a id="open"></a>

## 打开目标与复用

open 接收已经确定的本地作品 ID。来源身份解析和新增入库由相应入口及 ingest 完成。allowInteraction 和取消信号属于独立执行上下文。

| 方法                | 必填    | 可选选择                               |
| ------------------- | ------- | -------------------------------------- |
| sessions.game.open  | gameId  | launchConfigId                         |
| sessions.anime.open | animeId | episodeId 或 extraId、fileId、position |
| sessions.comic.open | comicId | volumeId、chapterId、fileId、position  |
| sessions.novel.open | novelId | volumeId、fileId、position             |

所有已提供参数同时约束目标。episodeId 与 extraId 互斥，文件必须属于指定作品，并满足指定分部关联。漫画同时指定卷和话时，核对两者的真实收录关系；只指定话时，不要求补充卷。任何约束无效都直接失败，不能丢弃参数后另选目标。

显式 position 必须同时指定 fileId，start 也不例外。动画使用 PlaybackPositionInput，阅读使用 ReadingPositionInput。分部参数只限定文件选择范围，不生成合订文件内部坐标。

省略选择时，依次考虑范围内有效会话、范围首选、归属明确的最近实际目标和唯一可用候选，再根据调用上下文判断是否允许交互选择。没有活动会话时，用户明确设置的首选优先于最近使用。选中的首选或最近目标失联时，应反馈问题并明确选择替代，不能静默换文件。显式目标始终按已提供的约束处理，不被首选或历史覆盖，也不自动修改首选。

“继续”入口从真实使用记录确定具体目标，并向同一个 open 传入相应 ID，不能省略目标后再依赖默认选择。改变首选不会改写“继续”已经明确指向的目标。原生界面、SDK、deeplink 和后台共用这些规则，不增加 preferred/resume 模式或按入口来源判断的例外。

| 公开方法            | 正常返回                |
| ------------------- | ----------------------- |
| sessions.game.open  | `Promise<GameSession>`  |
| sessions.anime.open | `Promise<AnimeSession>` |
| sessions.comic.open | `Promise<ComicSession>` |
| sessions.novel.open | `Promise<NovelSession>` |

open 成功表示实际内容可用，且必要的初始定位已经完成。游戏还须完成配置核对、真实启动、运行目标确认和观察建立，调用者无须另行启动监测。会话建立成功不代表立即开始计时。

系统已经接受启动请求，但运行确认失败、没有建立会话时，返回 GameLaunchUnconfirmed，安全说明区分确认等待结束或必要观察失败，并说明程序可能已经启动。请求尚未发出时的输入、占用、读取或系统请求失败，仍按各自错误报告。没有合法 Session 就不返回 partialResult，也不自动重试启动或随后接管残留目标。主动取消及调用归属失效保留 Cancelled、InstanceExpired 或 ConnectionClosed 等实际分类，不能改报确认超时；已经发出的系统请求不会因此撤回。

普通重开同一受管理目标时，显示并返回原会话，保留位置、播放暂停和计时暂停状态。明确请求同一文件的位置时，在原会话内完成定位，不隐含恢复播放。同一游戏已经运行时，明确要求另一个启动配置会报告已有运行。

同一文件从不同分部入口打开，仍只保留一个位置写入者。入口分部不能被当作文件唯一归属。不同文件则可以独立打开。

从异步打开开始到实际结束，文件身份受同一使用占用保护。holdings 可以在此期间测试规则和提供只读预览，但实际修改该文件的分部关联、访问路径或移除记录前，须按[文件修改边界](file-maintenance.md#file-use)结束受影响会话。结束释放占用后，尚待后台匹配的空关联文件重新按当前事实核对；旧识别结果和旧活动回调不能延迟写入新的上下文。

| 公共会话值   | 必须表达的实际上下文                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| GameSession  | sessionId、明确的游戏引用、launchConfigId、startedAt，以及适用的存档来源快照           |
| AnimeSession | sessionId、明确的动画作品引用、fileId、startedAt、settingsSource；文件引用 anime_files |
| ComicSession | sessionId、明确的漫画作品引用、fileId、startedAt；文件引用 comic_files                 |
| NovelSession | sessionId、明确的小说作品引用、fileId、startedAt；文件引用 novel_files                 |

会话通过顶层 type: game/anime/comic/novel 判别，并分别使用 gameId、animeId、comicId 或 novelId，不重复携带 work 对象。游戏保存实际 launchConfigId 和适用的 saveSource 快照，文件会话保存实际 fileId。运行资源不进入 DTO，需要跨类型引用时再组成 WorkRef。

后续修改首选、启动配置或存档来源，不改变已有会话身份、实际启动上下文和来源快照。游戏结束后的备份继续使用该来源；是否接纳自动备份则由备份能力按[同一启动配置的当前选择](backups.md#automatic)判断，不把启动时的开关保存为另一份会话状态。

<a id="switch"></a>

## 文件切换与连续使用

每个正式文件同时只有一个负责保存当前位置的活动上下文。打开或恢复过程中的默认首页、零秒位置，不覆盖正式记录。控制、计时和位置报告绑定本次上下文，迟到回调不能写入后来打开的文件。

当前使用界面通过以下完整操作切换文件。下一集、下一卷或下一话先按作品规则确定目标，再调用切换。

```ts
type FileSession = AnimeSession | ComicSession | NovelSession

type FileSwitchResult<S extends FileSession = FileSession> =
  | {
      outcome: 'ready'
      session: S
    }
  | {
      outcome: 'previousEnded'
      previousSessionId: string
      targetFileId: string
    }
```

```ts
sessions.anime.switchFile(sessionId, input): Promise<FileSwitchResult<AnimeSession>>
sessions.comic.switchFile(sessionId, input): Promise<FileSwitchResult<ComicSession>>
sessions.novel.switchFile(sessionId, input): Promise<FileSwitchResult<NovelSession>>
```

FileSwitchResult 由 desktop-contracts/sessions 定义。正常返回只使用 ready，session 必须已就绪且与方法的媒介相符；previousEnded 只作为 ExecutionFailure<FileSwitchResult<S>> 的合法 partialResult，表示本次已离开旧文件、尚未交付新会话。它不是半成品 Session，也不表示记录保存或资源清理必然成功。原生、IPC 和 Node SDK 保留同一判别值与字段。

input 必须包含 fileId，可以包含 position。targetFileId 固定为本次接纳的目标，previousSessionId 固定为被替换的原会话；异步结果不能改用窗口后来绑定的身份。目标文件可以属于另一部同类作品，实际归属由目标记录确定。跨作品类型则调用对应 open。

目标就是当前文件时复用会话，完成可选定位后以 ready 返回原 Session；定位失败不产生 previousEnded。目标已在另一会话中使用时，保留当前内容并报告冲突，界面可以提供聚焦已有会话的动作。

切换先准备目标，准备失败时保持旧内容，失败不携带部分结果。实际离开旧文件后，停止旧上下文的位置、计时和控制接纳，按 replaced 结束原会话；这个原因只描述旧文件为何结束，不保证新文件随后打开成功。最终记录与必要资源沿[关闭合同](#close)收尾，新会话发布前必须取得旧上下文的成功收尾结果。

旧内容已结束而最终记录保存失败时，保留[未保存记录](#pending-recordings)，以 RecordingSaveFailed 拒绝本次切换；必要资源清理失败按其实际错误拒绝。两者均携带 previousEnded，停止本次新会话的发布，继续清理已经取得的资源。实际会话从 list／get 消失，剩余资源的持有和占用仍由原拥有者管理，不能因已经形成部分结果就提前释放尚在使用的资源。底层可以复用健康的播放核心；原会话收尾不要求销毁仍服务于执行者的公共技术资源。

旧上下文正常收尾后，新内容加载、初始定位或呈现准备失败，也以原失败分类及 previousEnded 结束调用。已经取得的新目标资源由本次打开尝试清理；旧会话不恢复，也不发布新 sessionStarted。用户再次打开目标时使用对应 open，不能向已结束的旧 sessionId 重放切换。

新内容就绪并发布新会话后，以 ready 返回新 Session；旧 sessionEnded 先于新 sessionStarted，每项只发生一次。此前的取消按实际阶段停止：尚未离开旧文件时没有部分结果；旧内容已结束时，Cancelled 携带 previousEnded，并等待必要收尾。新会话已经完成提交后到达的取消不撤销成功。传输断开而无法确定结果时仍使用共同的未知结果规则，不伪造任何分支。

新内容使用目标作品和文件的位置、轨道及配置。用户主动暂停计时的选择随明确切换保留，但新会话累计从零开始，不转移旧时长或暂离等待。视频在普通暂停状态下切换文件时仍保持暂停，从末尾进入下一文件时则开始播放。

旧 Annotation 草稿保持原归属。关闭其编辑容器时，执行通用未保存确认。导航属于当前使用界面的运行流程，不增加公共身份。动画使用[作品级资料与文件列表](anime.md#views)，漫画和小说使用[作品内容列表](reader.md#work-navigation)，都不从调用方接收临时筛选清单或固定成员副本。同作品切换保留仍有效的查看方式、资料范围和筛选；切换到另一作品后采用新作品的完整范围，清除旧筛选和原作品的从属范围。流程结束或对应界面关闭后释放相关运行值。

各作品的目标选择见[小说](novels.md)、[漫画](comics.md)和[动画](anime.md)。播放到末尾是一种内容状态，不自动关闭会话，也不发布额外 endReached 业务事件。连续播放由原生流程驱动。

<a id="state"></a>

## 会话快照与运行值

```ts
interface SessionTiming {
  paused: boolean
  counting: boolean
  elapsedMs: number
  graceEndsAt: number | null
}

interface GameMonitoringState {
  available: boolean
  foreground: boolean | null
}

interface PlaybackState {
  positionSeconds: number
  durationSeconds: number | null
  paused: boolean
  buffering: boolean
  seeking: boolean
  atEnd: boolean
  speed: number
  volumePercent: number
  muted: boolean
  subtitlesVisible: boolean
  subtitleScale: number
  audioDelaySeconds: number
  subtitleDelaySeconds: number
}

interface ReadingState {
  position: ReadingPosition
  progress: number | null
  layout: 'reflowable' | 'fixedLayout'
  reflowing: boolean
}

interface PlaybackTrackRef {
  type: 'video' | 'audio' | 'subtitle'
  id: string
}
```

Session 同时表达固定上下文及适用的运行值。四类会话共有 timing；游戏另有 monitoring，动画另有 playback，漫画和小说另有 reading。

timing.paused 表示用户主动暂停记录，counting 根据暂停状态及其他实际条件计算。paused 为 true 时停止累计，其他条件也可能使 counting 为 false。elapsedMs 汇总本会话全部已确认区间，包含尚未到达保存检查点的确认部分。

暂离等待期间，间隔尚未计入，counting 为 false，graceEndsAt 提供截止时间。只有及时返回才计入等待间隔；没有等待时该值为 null。截止时间只用于界面显示，计时本身使用单调时间。

monitoring.available 表示是否能够可靠观察游戏进程集合的必要状态，foreground 无法确定时为 null。进程存活状态可靠时，前台未知只暂停前台计时，运行计时仍可继续。暂时失去必要观察会停止相应计时，但不能据此假定游戏已经退出；恢复与 interrupted 的判定遵守[游戏观察规则](games.md#observation)。不公开 PID 列表或系统句柄，也不增加与会话存在性重复的 running。

playback 保留最后确认的实际位置，未知时长使用 null。暂停、缓冲、seeking 和 atEnd 可以同时成立。倍速、音量、字幕及延迟都表示实际采用值。播放期间暂停计时，不会改变 playback.paused。

reading.progress 是当前文件正文阅读路径中的 0–1 显示进度，无法确定或明确进入独立辅助内容时为 null；临时查看保留主阅读进度。ComicSession 与 NovelSession 都按当前实际内容报告 reflowable 或 fixedLayout，不按 Work 类别固定 layout。混合文档在同一会话中切换版式，使用已经选定的完整阅读配置。重排期间保留最后确认位置。显示进度和当前排版页码都不能代替持久坐标或完成声明。

目录、搜索结果、轨道和选择几何按需读取，不装入每次快照。PlaybackTrackRef 只用于当前运行，持久选轨使用 [FileTrackSelection](anime.md)。

<a id="observation"></a>

## 查询、观察与生命周期事实

```ts
sessions.list(): Promise<WorkSession[]>
sessions.get(sessionId): Promise<WorkSession | null>
sessions.observeAll(listener): Disposable
sessions.observe(sessionId, listener): Disposable
```

list 返回当前会话，get 返回指定会话或 null。observeAll 先交付完整当前列表，随后交付变化后的完整列表；空数组不会结束观察。observe 先交付当前会话或 null，再按顺序交付变化；目标不存在或结束时，交付 null 并结束观察。

初次读取与订阅之间不能丢失变化。实现可以合并推送，无须按帧发送。所有接口使用相同 Session DTO，已经返回的对象不会通过隐藏可变引用更新。查询和观察不创建、恢复或聚焦内容，释放 Disposable 只停止接收。当前使用列表直接观察运行集合，不通过生命周期事件自行拼装成员。

新内容就绪时发布一次 sessionStarted，复用原会话不重复发布，未确认启动也不发布虚假事件。sessionEnded 保留原实际上下文，并增加 endedAt 和 reason。记录保存问题与实际结束原因分别表达。载荷及投递规则见[通信合同](../communication.md)，高频位置变化不进入全局事件目录。

<a id="personal-status"></a>

## 实际使用与个人记录

会话维护实际运行、文件位置和活动；作品状态与完成由[个人记录操作](records.md#operations)管理，独立关系见[记录含义](records.md#model)。UI、深链和 SDK 共用这条边界。用户在片尾记录作品完成后，播放和后续有效计时仍继续。

动画的[自动已看](anime.md#auto-completion)可在播放中设置分部标记，触发条件与保护范围由动画领域定义；其他媒介的标记沿明确操作处理。

<a id="timing"></a>

## 有效使用、暂离与保存

阅读内容就绪后，根据实际阅读窗口是否在前台累计时间，不用主窗口前台状态或输入活跃度代替。采用前台计时的游戏，其专属面板属于该会话前台；阅读器侧栏交互同样属于对应会话。窗口仅置顶但未获得焦点、主资料库或其他作品面板，都不算该会话前台。会话结束后的编辑不计时。

全局暂离宽限默认为 10 分钟，可以调整，0 表示不续接。阅读与采用前台计时的游戏共用此设置，不提供逐作品或启动配置覆盖。已经进入等待时，使用进入等待时的值，后续策略更改不重写历史。

| 情形                                       | 活动记录与计时                                                   |
| ------------------------------------------ | ---------------------------------------------------------------- |
| 普通离开前台                               | 保留原活动与使用上下文，显示暂离，不立即分段，也不写入待确认间隔 |
| 宽限内返回原使用上下文                     | 接续同一条活动记录，并将暂离间隔计入有效时长                     |
| 宽限到期仍未返回                           | 原活动结束于离开前台时刻，暂离间隔不计入；以后返回时创建新活动   |
| 主动暂停、关闭、结束、锁屏、休眠或观察中断 | 结束当前有效区间，不补入待确认的暂离时间                         |
| 更换实际文件或结束后重新启动游戏           | 按实际使用上下文区分，不通过宽限拼接不同文件或游戏会话的活动     |

等待只保存在运行上下文中。及时返回时，更新同一活动的绝对累计值，不创建待确认时间表或事后合并系统。超时后返回可以开始新活动，但仍属于原 Session。异常结束不补入未确认间隔。宽限被计入后，总时长不能称为严格的前台驻留时间。

游戏的运行计时根据实际运行观察累计后台时间，不使用前台宽限。运行计时和前台计时都受用户暂停、锁屏、休眠及观察中断约束。游戏监测集合的成员变化不建立新会话，也不按成员数量重复累计，具体规则见[游戏监测](games.md#observation)。

视频按实际播放用时累计。暂停、缓冲和跳转间隙不计入，倍速也不会放大实际用时。自动已看依据[动画覆盖规则](anime.md#auto-completion)修改文件直接关联的分部，当前位置不能代表已经观看的范围。关联多个分部仍只累计一次实际时长；作品完成始终不由播放或分部标记推导。

主进程使用单调时间确定区间。四类会话在存在已确认的时长或位置变化时，每 5 秒保存当前值；没有变化时不写入。活动区间收束、切换实际文件或结束会话时，立即保存最后确认的值，不等待下一个周期。定时写入不依赖下一次进度事件，已经确认的新位置即使随后没有变化，也在正常保存周期内提交。

同一活动始终更新绝对累计时长，定期保存不创建新活动，重试也不能重复相加。暂离宽限中尚未确认的间隔仍不写入。UI 的秒级计时独立展示运行投影，不由数据库写入频率驱动，也不能用于崩溃后的时间补算。

<a id="clock"></a>

### 单调计时与 UTC 区间

每个新活动区间在开始时取得同一次采样的 UTC 毫秒与单调时刻作为锚点。区间内的发生时间使用 `起点 UTC + 单调经过时长`，有效时长只累加已经确认的使用区间；保存 UTC 值时按毫秒取整，单调小数余量留在运行内累计。暂停、缓冲和其他不计时条件继续按各自规则处理，因此有效时长不大于该区间长度。

在计时状态变化、每次保存检查点和收束前采样两个时钟。当前 UTC 与锚点投影相差超过 1,000 毫秒时，视为本次可观察的系统校时；该内部容差只用于忽略采样和正常微小校准差异，不改变暂离宽限或用户时长设置。单调时刻自身倒退或不可用属于观察中断，不按 UTC 校时续接。

| 情况                     | 活动与运行状态                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| UTC 与单调投影在容差内   | 沿原锚点保存绝对累计值，不反复移动已开始活动的起点                    |
| UTC 明显回拨或前跳       | 在最后可信采样的投影时刻结束旧活动；该采样至本次采样的间隙不补计      |
| 校时后仍满足实际计时条件 | 以本次 UTC 与单调采样建立新区间；保留原 sessionId、文件及用户暂停状态 |
| 校时发生于暂离等待或暂停 | 结束原待续接范围，不补入待确认间隙；下一次满足计时条件时再开始新区间  |
| 旧区间没有形成正长度     | 不创建空活动；已经保存的有效活动保持原身份和数值                      |

旧区间的结束与新活动的建立使用正常记录保存边界。保存失败时保留确定的检查点，按既有重试与未保存记录合同处理，不重新解释时钟或重复增加时长。校时不改写已保存历史、完成日期或文件位置，不自动结束使用会话，也不触发游戏退出备份。

起止时间仍是各区间自己的 UTC 日历依据，按日统计沿保存值分配。回拨后新旧区间可能重叠，前跳可能留下日历空隙；它们各自保留已经确认的有效时长，统计不以去重或补齐时间轴改变事实。旧记录暂时晚于新的系统当前时间时正常读取，不将其修补为今天；手动新增和修改仍执行自己的时间约束。

运行期限和暂离截止继续使用单调时间。graceEndsAt 等界面时间按当前 UTC 与剩余单调时长投影，不将它反用为计时或超时依据。校时分段属于记录的正常维护，不要求用户确认，也不为每次分段发送提示。

<a id="controls"></a>

## 当前内容控制与聚焦

| 范围             | 方法                                            | 含义                                         |
| ---------------- | ----------------------------------------------- | -------------------------------------------- |
| 四类会话         | pauseTiming(sessionId)、resumeTiming(sessionId) | 暂停或恢复有效时长记录，不改变内容本身的运行 |
| 动画             | play(sessionId)、pause(sessionId)               | 控制实际播放，正常计时仍受实际播放状态约束   |
| 动画、漫画、小说 | seek(sessionId, position)                       | 在当前文件内按相应内容位置定位               |
| 四类会话         | focus(sessionId)                                | 请求将实际使用内容窗口带到前台并聚焦         |

控制方法分别属于 `sessions.<workType>`，始终指定实际 sessionId。resumeTiming 只解除用户暂停，不绕过其他累计条件。seek 接收具体坐标或 start，只定位当前文件，不切换目标，也不隐含继续播放。它等待实际结果，动画返回实际秒数，阅读返回 ReadingPosition，不回显 start。焦点、播放暂停和计时控制完成后返回 void。

已经结束的会话不再接受控制，应报告目标失效，不能转向后来重开的同一作品。close 单独遵守[幂等结束规则](#close)。公共 API 不提供任意状态修改或引擎属性透传。

focus 显示本次游戏的实际窗口、播放器或阅读器，必要时恢复最小化并请求焦点。它不创建会话，也不清除暂停。游戏的目标窗口按[窗口选择规则](games.md#windows)确定，面板的显示和隐藏另由 UI 管理。

实际焦点是否获准由操作系统决定，真实焦点变化才参与计时。平台约束见 [Electron focus](https://www.electronjs.org/docs/latest/api/browser-window#winfocus) 和 [Windows 前台规则](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)。

<a id="playback-controls"></a>

## 播放设置、轨道与记忆

sessions.anime 的运行设置都绑定 sessionId。仅控制当前运行的 setSpeed、setSubtitlesVisible 返回 `Promise<void>`；需要保存的音量、静音、同步偏移、字幕缩放，以及带可选记忆的 selectTrack 返回下述 PlaybackSettingResult。正常完成均等待实际采用，运行状态继续由 observe 交付。

| 能力             | 方法                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| 速度、音量与静音 | setSpeed(sessionId, speed)、setVolume(sessionId, volumePercent)、setMuted(sessionId, muted)       |
| 字幕呈现         | setSubtitlesVisible(sessionId, visible)、setSubtitleScale(sessionId, scale)                       |
| 音画与字幕同步   | setAudioDelay(sessionId, seconds)、setSubtitleDelay(sessionId, seconds)                           |
| 轨道选择         | selectTrack(sessionId, track, options?)，track 使用 PlaybackTrackRef，options.remember 默认 false |

setSpeed 是当前文件的临时倍速控制，只采用到实际播放器，不写入全局、作品或文件配置，也不自动启用自定义。暂停后继续、聚焦、同一文件的定位和普通复用保留当前倍速；切换到下一集或其他实际文件、关闭后重新打开时，重新采用目标的完整配置中的 playbackSpeed。临时倍速不随连播交给新文件。需要长期默认值时，用户在播放设置中明确选择范围并保存。

同步偏移使用有符号秒数，字幕缩放使用倍数。倍速、字幕缩放与音量复用[偏好字段值域](preferences.md#fields)，在保存或控制前完成校验；volumePercent 为 0–100 的有限数，超限拒绝，不静默钳制。sessions.anime.getTracks(sessionId) 返回当前轨道列表。observeTracks(sessionId, listener) 先交付当前列表，再交付变化，返回 Disposable。

轨道项包含展示资料、实际选择及 PlaybackTrackRef。允许记忆的轨道还提供由主进程接入生成的 FileTrackSelection，调用者不能解析运行 ID 来推导源文件或序号。

selectTrack 的 remember 明确区分本次选择与文件记忆。省略或传 false 时只控制当前播放；传 true 时，由 sessions 在同一次完整操作中取得实际文件及可持久的轨道选择，调用 library 保存，再交给当前执行者采用。音轨和字幕支持文件记忆；视频轨不支持记忆，相关请求在产生副作用前拒绝。原生界面、SDK 和后台都使用同一输入及行为，不根据调用来源决定是否保存。

原生选轨入口需要记住选择时，只调用一次完整操作：

```ts
await sessions.anime.selectTrack(sessionId, track, { remember: true })
```

sessions 固定并校验实际会话、文件和轨道，协调保存与采用的执行顺序。保存失败时不继续采用；保存成功而采用失败时，由该操作按共同失败合同明确报告已经保存和未生效的事实，运行观察继续交付实际状态。会话结束或换文件后，原请求不能转投新的内容。界面负责输入和反馈，不自行拼接 library 写入与播放控制。恢复和临时控制使用不记忆的输入，也不通过观察反写设置。

音量与静音由 preferences.playback 保存应用级控制记忆，轨道与同步偏移由 library 保存为文件选择，速度和字幕缩放等长期默认值属于完整播放配置。setVolume 与 setMuted 固定当前会话，分别通过 preferences.update 只保存 volumePercent 或 muted，再采用到该执行者；它们是即时设置，沿用普通逐字段写入，不改变另一字段，也不联动其他已打开实例。临时倍速不进入保存流程，观察不能反推用户设置。

新文件的执行者准备从 preferences.playback 读取当时的正式音量与静音，首次使用为 100% 和未静音；初始采用不回调会保存设置的公共控制方法。普通同文件复用保留当前值，切换实际文件或关闭后重新打开则读取最新正式记忆。完整播放配置的保存或重新采用不覆盖这两个独立控制值。

<a id="playback-setting-result"></a>

### 保存与运行采用的结果

```ts
type SavedPlaybackSetting =
  | { field: 'volumePercent'; scope: 'application'; value: number }
  | { field: 'muted'; scope: 'application'; value: boolean }
  | {
      field: 'audioDelaySeconds' | 'subtitleDelaySeconds'
      scope: 'file'
      value: number
    }
  | { field: 'subtitleScale'; scope: 'global' | 'work' | 'file'; value: number }
  | {
      field: 'audioTrack' | 'subtitleTrack'
      scope: 'file'
      value: FileTrackSelection
    }

type PlaybackSettingResult = {
  sessionId: string
  animeId: string
  fileId: string
} & (
  | { outcome: 'applied'; saved: null }
  | { outcome: 'applied' | 'saved'; saved: SavedPlaybackSetting }
)
```

sessionId、animeId 和 fileId 固定本次实际目标；scope 使用这些 ID 指明文件或作品范围，application 表示应用记住的上次音量／静音，global 表示完整播放默认配置。saved 只包含已经持久成立的那一项及实际保存值，不复制整套偏好、临时轨道 ID 或运行快照。FileTrackSelection 直接使用[轨道合同](anime.md#tracks)，实际轨道种类由 field 限定。

| 结果                             | Promise 与机器字段                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| 不记忆的轨道选择完成             | 正常返回 outcome: applied、saved: null                                                       |
| 保存及实际采用均完成             | 正常返回 outcome: applied，saved 为该操作真实保存项                                          |
| 保存没有成立                     | 拒绝调用，保留实际错误；不提供伪造的 saved 结果，也不继续运行采用                            |
| 已保存，运行采用失败             | 以 PlaybackApplyFailed 拒绝，partialResult 为 outcome: saved 与完整 saved 项                 |
| 已保存，后续取消或目标／实例失效 | 保留 Cancelled、TargetChanged 或 InstanceExpired 等实际分类，同时交付同一合法 saved 部分结果 |
| 通信中断且提交结果无法确认       | 按 ConnectionClosed 处理；没有 partialResult 不证明未保存，不自动重发                        |

正常返回不会使用 outcome: saved；它是共同 ExecutionFailure 所允许的合法部分结果。所有调用方直接读取 partialResult.outcome 与 saved，不解析错误文案，也不依靠另一条查询猜测本次保存是否发生。其他独立窗口仍按自己的运行状态呈现，已完成保存不因采用失败回滚。

音量和静音通过 preferences 保存，文件同步偏移通过 library 保存，均由 sessions 固定目标并仅采用到当前执行者；观察与初始恢复不会调用这些保存入口。每次结果只描述这一次操作，后续明确修改不改写已交付结果。

<a id="subtitle-scale"></a>

### 字幕大小的即时保存

setSubtitleScale(sessionId, scale) 是保存并采用当前字幕缩放的完整操作。保存目标是本会话已经采用的完整播放配置来源：文件自定义、作品自定义或全局默认。AnimeSession.settingsSource 使用 file、work 或 global 表达该来源，作品与文件 ID 沿用本会话的已有字段，供界面显示实际保存范围。来源反映本次实际采用，不由界面另查最新配置并猜测，也不另存持久的当前来源。

sessions 固定当前会话、实际文件和采用来源，再调用对应的 library 或 preferences 写入操作。只修改该来源中的 subtitleScale，保留其他设置和自定义启用状态，不复制临时倍速，不隐式新建或启用另一层自定义。来源失效或相关配置变化使此次保存不再适用时，按共同并发规则报告问题，不能转写另一个范围。

保存成功后，只向当前内容执行者采用本次字幕缩放，保留临时倍速、播放位置、字幕显隐、轨道及其他运行控制值，不重新应用整套配置。其他已经打开的播放器保持原状；下一文件或重新打开时，仍按既有层级选择完整配置，采用其中已经保存的字幕缩放。

操作等待保存与实际采用完成后返回 PlaybackSettingResult，其中 saved.field 为 subtitleScale，scope 为本次真实采用来源。保存失败不继续采用；保存成功但执行者采用失败时，按[结果合同](#playback-setting-result)交付已保存部分，观察继续返回实际缩放。切换文件或会话结束后，旧请求不能转投新内容。界面不自行拼接保存与控制，原生、SDK 和后台共用这一合同。初始配置恢复直接交给执行者，不反调会保存设置的公共调整操作，也不通过引擎观察回写。

<a id="execution"></a>

## 内容执行者与窗口通信

| 操作范围                                       | 拥有者                         |
| ---------------------------------------------- | ------------------------------ |
| 打开作品、选择实际文件、换文件、结束会话与计时 | 主进程 sessions 及相应业务协调 |
| 正式位置、活动、完成记录与 Annotation 保存     | 主进程 library                 |
| 持久偏好修改                                   | 主进程对应设置能力             |
| 当前文档内翻页、滚动、选区、搜索、定位与呈现   | 当前内容执行者                 |

主进程拥有产品会话和窗口绑定，内容始终只有一个实际执行者。阅读窗口中的翻页、滚动、选区、搜索和定位直接调用当前 reader。公开 sessions 控制先由主进程核对实际会话，再路由到同一执行实现。

主进程判断哪个会话可以控制，执行者判断当前文档操作是否有效。两者不重复实现规则，也不逐项转发 Kana 的全部 API。视频执行者位于主进程，播放器窗口通过 IPC 调用。

内部窗口通信使用 Electron IPC，并由共同 rpc 内核处理调用关联、返回、取消和释放。preload 只暴露类型化入口，普通数据可序列化，Kana 对象留在阅读窗口。这是应用私有合同，不属于 SDK 或 deeplink，也不需要另建服务器、消息总线或脚本执行入口。参考 [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)。

控制和报告都核对当前绑定及来源。准备期可以分配标识，但只有实际就绪后才公开 Session。窗口不能自行换文件并沿用旧身份，窗口复用也不能让旧调用命中新内容。接受关闭后拒绝新控制，取消传给原执行。已经取消的打开如果迟到产生资源，必须释放。

实际位置和选区由执行者产生，主进程据此采用正式记录，不能先把请求位置当成执行结果。普通状态可以合并，但最终位置交付和保存确认必须进入关闭等待，不能把通知已发送视为收尾完成。

<a id="engine-completion"></a>

## 引擎的打开、定位与结束条件

完整打开包括资源准备、内容可读或可播、呈现通路就绪，以及明确初始定位完成。它不要求预先解码整段视频或分页整本书。定位失败后停在首页，不算恢复成功。

视频的完整加载、定位，以及定位后的恢复由 infrastructure/media 组合 libmpv 的命令、属性和事件实现，分别等待实际状态；Node 绑定只交付对应上游操作结果，不把命令回执改写为内容操作完成。事件依据见 [mpv 事件](https://mpv.io/manual/stable/#list-of-events)。

控制不顺带切换文件、重新选择作品或修改首选。seek 以实际位置结束，失败时保留仍有效的上下文。连续拖动可以按最新意图合并，但被替代的调用必须明确结束，不能拿后一次结果当作前一次成功。

到达末页或播放末尾不会自动结束会话。视频保留末尾状态，技术库不自行选择下一份作品文件。关闭时先拒绝新控制，停止当前内容和未完成的读取、搜索及定位，保留最后可信状态，再释放资源；本体取得最后记录的保存结果后，按[关闭合同](#close)结束会话。

销毁后的空位置不能覆盖续读记录，也不新增 CloseResult 只为取得最终位置。单次操作失败不一定需要关闭整个实例，只有实例无法继续可靠工作时，才按实际故障结束。系统不能补造未知的最后位置或使用时段。

采集所得图像、位置和文件必须来自同次实际执行。原始内容取得后，编码、附件准备和草稿不再依赖会话继续存在；原始内容取得前会话结束，则本次采集失败，不能转向新上下文。具体规则见[内容采集](#capture)。

<a id="resources"></a>

## 技术数据与呈现资源的寿命

技术状态通过小快照和变化订阅交付。资料在打开时或按需查询，呈现资源由相应技术机制管理。订阅先交付当前快照，解除订阅不关闭内容。未知时长和进度为 null，暂停、缓冲及定位状态分别表达，技术库内部状态不直接成为本体 API。

Kana 提供当前版式、源位置、可空进度、相互对应的文字范围与完整摘录、指定位置的邻近原文，以及原始页面区域。没有选择时返回 null。本体提供受控文件及成员读取、取消、阅读偏好、定位意图和只读标记 { id, location, quote? }，统一处理标记样式与当前选中状态。标记交互返回不透明 id，不赋予 Kana 保存 Annotation 的职责。

libmpv-node 交付 mpv 命令结果、属性与事件，以及可选渲染输出的帧资源；media 组合这些实际值实现内容操作，并映射为本体合同。原生帧包含像素尺寸、格式、有效矩形、颜色解释、必要时序、平台句柄和同步条件。screenshot-raw 的图像结果包含尺寸、格式、stride 与独立数据；同次确认的媒体位置和文件上下文由 media 关联，作品归属由 sessions 核对。

普通播放通过共享纹理交付画面。Kisaki 接入构造 Electron 的[共享纹理输入](https://www.electronjs.org/docs/latest/api/structures/shared-texture-import-texture-info)和[平台句柄](https://www.electronjs.org/docs/latest/api/structures/shared-texture-handle)；Windows NT handle、macOS IOSurface 和 Linux nativePixmap 由独立包及平台适配处理。平台句柄留在原生接入中。

[VideoFrame.timestamp](https://www.w3.org/TR/webcodecs/#dom-videoframe-timestamp) 使用微秒，NativeFrame.targetTimeNs 使用所属 Mpv 时钟的纳秒调度时间，具体依据见[渲染时序](../projects/libmpv-node/video.md#timing)。接入分别解释时钟与单位；调度时间和生产序号均不表示文件位置或源帧 PTS。screenshot-raw 的采集位置继续取同次执行中紧邻的实际媒体位置。

资源从生产、导入、交付 VideoFrame 到释放，必须形成完整生命周期。队列与资源池有界，可以丢弃尚未交付的旧帧；已经交付的资源必须等待真实消费引用释放，不能因下一帧到来、窗口切换或会话结束而提前复用。NativeFrame 交付后由接收方持有，可以独立于 Mpv 存活。media 收到 Electron [allReferencesReleased](https://www.electronjs.org/docs/latest/api/shared-texture) 后才调用 NativeFrame.release；单个导入对象的 release 不代表全部引用已经释放。

播放器关闭遵守[实例、输出与帧寿命](../projects/libmpv-node/lifecycle.md#ownership)：停止新的帧交付并完成 Mpv 自身收尾，已经交付的帧由独立持有关系保持有效，不等待调用方归还所有帧才结束 Mpv。停止订阅同样不释放已经交付的帧。Kisaki 的会话关闭还必须完成显示侧引用回收与正式记录保存，不能把 mpv.close() 完成直接当作整次会话收尾完成。采集图片取得独立数据后，后续图片处理不再持有 NativeFrame。

Kana 同样明确文档视图、页面及排版资源的持有和释放。独立项目负责自身完整 API 与平台实现，本体 DTO 不导入 Kana 或 libmpv-node 类型。每个支持平台都要验证实际表面、字幕、颜色、设备变化、释放和采集，不能由单个平台通过推定其他平台也通过。

<a id="capture"></a>

## 内容采集与标注草稿

| 方法                                   | 返回内容                                |
| -------------------------------------- | --------------------------------------- |
| sessions.game.captureImage(sessionId)  | gameId、image                           |
| sessions.anime.captureImage(sessionId) | animeId、fileId、positionSeconds、image |

返回的 image 是 [PreparedImage](attachments.md#images)，表示原始内容已经取得并准备可用。游戏采集实际游戏内容，视频采集当前内容的 SDR 画面和字幕。media 按[截图接入条件](../engineering/integrations.md#screenshot)使用就绪的受管 sRGB GPU 输出、screenshot-sw=no，以及原生 screenshot-raw 的 subtitles 标志与 rgba 格式，核对返回布局和实际 source。只有已验证 GPU 条件中的 source: vo 可以准备图片；software、缺失或未知来源返回 CaptureUnavailable。HDR 片源也须经过正确的 SDR 映射，不能因命令成功而接纳软件回退。应用工具栏、面板及编辑按钮不进入图片。采集不隐含暂停、创建标注或打开编辑器。

游戏采集遵守[实际窗口与截图规则](games.md#windows)：需要时先恢复最小化目标，确认恢复后的画面可用再取得原图，随后才进行可选裁剪。窗口选择、恢复或采集失败只结束该次操作，不使仍可正常观察的游戏会话中断。

media 组织视频打开、切换、定位和采集的明确执行顺序。采集固定实际文件，在取得原图及紧邻的实际媒体位置之间，不允许切换或 seek 插入。上下文尚未就绪或已经失效时，等待已接纳的控制完成，或明确失败。file-loaded 本身不能证明首次画面或 seek 已完成。

位置在编码和附件准备之前固定，不使用 UI 中的旧进度。正常播放可以继续，采集不承诺严格零帧误差。

视频标注采用这次画面后，可以按[片段规则](annotations.md#video-values)另设或调整范围，已有图片保持不变。明确重取画面时仍使用 captureImage，并核对采集文件与目标一致；调用者只采用本次明确修改的图片，不把返回时间顺带写回旧范围。采集不增加任意时间点取帧接口，也不为范围起点隐含改变播放位置。

漫画和小说先选择原内容，固定定位及对应原文或画面，再创建或编辑标注。位置书签按[书签内容规则](annotations.md#bookmarks)取得当前位置，并保存邻近原文或可见内容画面；动画时间点书签使用同次 captureImage 返回的位置和图像。文字标注一次取得相符的范围和完整原文，页面区域标注取得 ReadingPageRegion。没有文字选区时返回 null。不提供公开漫画或小说 captureImage，也不先截取视图、再裁图推导正式区域。

绑定当前文档的内部阅读接入组织位置书签的采集，将文件、源位置及相应原文或画面固定为同一次结果。原文由 Kana 解释，图像由实际内容视图取得；滚动、重排或换文件不能使位置和图像来自不同上下文。该接入另提供页面区域图像操作：

```ts
captureRegionImage(region: ReadingPageRegion): Promise<PreparedImage>
```

输入是已经选定的原始页面和区域，不接收窗口像素，也不唤起框选。操作只取得当前已经呈现的区域内容，排除选择框和控件，不扩展为任意未显示页面的导出。执行期间不能改读另一选区。用户要求保留图像而采集失败时，应明确失败，不能静默保存无图标注。

用户采用选区时，固定作品、文件、位置、原文或区域。草稿随后保持这份归属，取得独立原始内容后可以继续处理和保存。图像通过 image_id 作为正式附件引用，缩略图由该图像生成。

正式采用通过 library.annotations.create/update 和附件机制完成，选区与采集结果由当前编辑流程管理。坐标映射和图片内容排除规则，都须在缩放及旋转场景中验收。

<a id="close"></a>

## 正常关闭、强制终止与收尾

sessions.game.close、sessions.anime.close、sessions.comic.close 和 sessions.novel.close 都接受 sessionId，返回 `Promise<void>`。它们结束实际使用，并完成本会话必要收尾。游戏请求实际目标正常退出，动画停止并释放播放内容，漫画和小说关闭阅读内容。隐藏界面不代表结束，也不要求终止承载 UI 的进程。

四类会话共同参与 app 的[完整退出流程](../ui/navigation.md#shutdown)。退出界面统一呈现本次参与会话的关闭与收尾进度、结果，具体关闭由所属类型执行；不为游戏另建应用退出流程，也不为了界面对齐给其他类型补造强制终止能力。

正常返回前，必须确认内容已结束、最终计时和位置已保存、资源收尾已完成。只发送关闭请求不算成功，也不返回新实体或 TaskRunRef。游戏拒绝关闭、无法发送正常退出请求或等待超时时，应报告关闭未完成，并保留仍有效的观察。

取消只结束本次调用等待及必要的调用收尾，不停止游戏会话管理。已经发送的退出请求可能稍后生效，届时仍正常收尾；已经完成的事实不能回滚。

内容已经结束而最后记录保存失败时，close 按共同失败合同报告 RecordingSaveFailed，保留本次运行内的最终记录快照供明确重试。必要资源仍正常清理，实际会话结束并释放使用占用，原因保持真实；待保存快照不伪装为仍在运行的会话。具体保存、重试与退出规则见[未保存记录](#pending-recordings)。

本次关闭仍在执行时，重复调用等待同次执行结果。执行结束后，对不存在或已经结束的 ID 幂等完成；close 本身不重试保存，也不重复发布事件，未保存快照通过明确的 recordings.retry 处理。这次幂等返回不改变先前操作的失败结果。仍存在的会话必须符合所调用命名空间的作品类型。旧 ID 不转向后来的会话，也不为识别旧 ID 建持久表。

sessions.game.terminate(sessionId): `Promise<void>` 明确强制终止已经确认的目标，仍须等待系统确认结束，并完成相同收尾。close 失败不自动升级为 terminate，不使用 force 参数，其他三类会话也不提供 terminate。

游戏 close 与 terminate 在固定截止时间内处理本次范围中的动态进程集合。重复调用、明确强制终止接替普通关闭、共享成员的请求合并、新确认的成员、连带退出、请求与退出竞态，以及 PID 复用都按[游戏结束规则](games.md#ending)处理；某个成员已退出不构成关闭失败，也不单独证明整个会话已经结束。

正常与强制路径必须使用真实不同的机制。Windows 正常关闭使用目标窗口 WM_CLOSE 等请求，游戏可以处理、确认或拒绝，因此不保证接受或保存。强制路径使用 TerminateProcess 等系统机制。参见[窗口关闭](https://learn.microsoft.com/en-us/windows/win32/learnwin32/closing-the-window)和 [TerminateProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess)。Windows 上 Node 的 kill('SIGTERM') 与 kill('SIGKILL') 都会强制终止，不能分别包装为正常和强制路径，见 [Node 终止合同](https://nodejs.org/api/child_process.html#subprocesskillsignal)。其他平台使用各自真实机制。

本次收尾形成成功或失败结果后，按[会话事件](../communication.md#session-events)发布一次真实结束事实。主进程内按[通知交接](../communication.md#event-delivery)完成同步交付；close 和 terminate 不等待订阅者的后续业务，也不等待独立备份完成。退出后的自动备份单独报告结果；应用退出协调器仍须等待相关备份和任务完成，再释放依赖。游戏面板随会话结束自动关闭，未保存编辑按[面板关闭规则](games.md#panel)处理；草稿处理不阻止真实会话结束，也不会使已结束会话继续活动。

<a id="detach"></a>

## 退出应用时停止游戏记录

用户在完整退出流程中选择“停止游戏记录并退出”时，app 调用原生 sessions.game.detach(sessionId): Promise<void>。它保存本次已确认活动，结束应用对该游戏的计时、观察、面板及占用，然后交付完成；不发送进程关闭或终止请求。该入口属于本体退出协调，不向 Node SDK、普通深链或后台自动行为开放。

已知游戏确实退出时继续按 exited 收尾；仍在运行或没有确认退出时，明确脱离使用 detached。结束时间表示应用结束管理的时刻，不能用于推断外部游戏何时退出。detached 不触发退出备份，也不登记完成事实；后续活动不再记录，重启后不自动接入残留进程。

操作先完成未保存编辑检查，再核对实际会话并保存最后已确认区间。保存成功前保留观察与占用，保存失败则拒绝脱离并保留会话，不发布结束事件；用户可以修正问题后重试或取消退出。准备完成后，最终区间捕获、同步记录提交与旧回调失效在同一串行收尾段完成，之间不插入异步等待。提交成功即固定 endedAt 并停止接纳新计时，再完成资源收尾、释放占用并发布至多一次 sessionEnded。提交之后的迟到取消不恢复旧会话或重放已保存活动。

正常关闭或强制终止仍在发送请求时，detach 返回 Busy。调用方先结束或取消该次操作的等待与后续请求，再明确脱离；已经发出的系统请求仍可能稍后生效。

脱离提交后，资源释放失败只保留未完成的清理工作，计时保持停止。重复 detach 等待现有收尾，前次清理失败时只重试剩余部分；收尾全部完成后，对旧 ID 的调用幂等成功。相应占用在必要清理结束后释放，旧请求始终绑定原会话。

目标命名空间不符返回 InvalidReference，未保存检查被拒绝按用户取消处理，记录保存与资源清理失败分别报告。

其他三类会话仍通过自己的 close 停止内容并保存位置。取消整次退出不会重新接入已经明确脱离的游戏；应用恢复正常接纳后，仍按既有运行检查处理新的启动请求。

<a id="pending-recordings"></a>

## 已结束内容的未保存记录

实际内容已结束而最终活动或位置未能保存时，sessions 在主进程保留该会话的最终可信快照。每个 sessionId 只有一份，固定原作品、实际文件或配置、活动 ID、结束时间、绝对时长和最后可信位置；重试不重新计时、不读取后来会话的值，也不创建另一条活动。正在使用期间的定时保存失败仍由实际会话保留当前值，结束时归并到这份最终快照。

已结束的 Session 仍从 list／get 消失，资源按正常合同释放；未保存记录独立出现在原生“未保存记录”Dialog 和退出流程中。该状态只存在于本次主进程内，不建立持久表、TaskRun、后台自动重试或跨重启恢复文件。渲染端重载和关闭来源窗口不会清除它；进程崩溃或系统强制终止可能失去这些尚未提交的值。

### 保存单位与后续修改

活动写入与文件位置分别按自己的完整操作提交，快照记录各单位的确定结果；已经提交的单位立即移出待保存范围，后续失败不会使它重新执行。活动沿原稳定 ID 写入绝对值，首次提交失败时仍保留已分配的 ID。数据库提交成功而通知失败不算记录未保存，通知错误不能导致再次新增活动。

活动重试只比较该活动上次成功保存的起止与时长基线；首次创建仍检查原 ID 未被占用。用户已经明确编辑该活动时返回 Conflict，不能覆盖新值。元数据、评分和无关活动变化不阻止重试。需要删除或合并剩余快照所引用的作品、分部、文件、启动配置或活动时，先保存或明确放弃相应快照，返回 PendingRecording 并提供原生处理入口；这项约束不等于内容仍在使用。

重新打开内容仍然可用。文件位置重试同时检查原保存位置基线和本次运行中的位置写入顺序：后来会话已接管该文件的位置，或用户已明确修改位置时，旧位置返回 PositionSuperseded，保持当前值。即使位置数值后来相同，也不能据此恢复旧快照的写入资格。这个顺序由持有写入边界和会话在本次运行内维护，不增加持久版本列；活动部分仍可独立保存。用户可先重试活动，再明确放弃剩余旧位置。

### 原生处理接口

以下能力只向本体原生界面和退出协调开放；SDK 保留 close 的实际失败结果，不取得放弃用户未保存记录的权限。

| 方法                                        | 确定输入与结果                                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sessions.recordings.list()                  | 返回按 endedAt、sessionId 稳定排列的摘要数组；每项包含 sessionId、WorkRef、实际目标、endedAt、未保存的 activityIds、是否有 position，以及安全错误摘要，不返回内部快照或引擎对象。                                                |
| sessions.recordings.retry(sessionId)        | 返回 `{ sessionId, savedActivityIds, positionSaved, remainingActivityIds, positionPending, issues }`。只尝试仍未完成的单位；任一失败时以 RecordingSaveFailed 拒绝，并通过同类型 partialResult 交付已经成立的结果，快照继续保留。 |
| sessions.recordings.discard(sessionId)      | 用户明确选择后丢弃该 ID 剩余的未提交单位，返回 void；已经保存的活动和位置保持不变。                                                                                                                                              |
| sessions.recordings.onInvalidated(listener) | 返回 Disposable；待保存范围变化后通知原生界面重读，不承载保存命令。                                                                                                                                                              |

issues 区分 `{ kind: 'activity', activityId, error }` 与 `{ kind: 'position', error }`；error 使用 ErrorSummary，可明确识别 PositionSuperseded、Conflict 或实际持久化失败。已经完成的单位不保留旧错误，list 使用当前剩余单位的同一问题摘要。

重复 retry 等待同一次处理。不存在待保存快照的旧 ID 幂等返回空保存结果；discard 同样幂等。并发放弃先等待正在提交的短操作结束，再丢弃剩余单位，不撤销已确认提交。取消重试只停止尚未开始的单位，结果保留已提交与仍待处理的范围。成功、放弃和重试失败都不重发 sessionEnded，也不重新触发游戏退出备份。

原生 Dialog 显示作品、结束时间、未保存内容和失败原因，提供“重试保存”与“放弃未保存记录”；放弃只针对明确选中的会话。退出或更新重启前必须清空这份待处理集合：保存成功、明确放弃，或取消退出留在应用。用户未选择时不能自动丢弃；普通关闭与退出共用同一份集合，不分别保存快照。

明确 detach 仍先保存再结束管理；保存失败时游戏会话还存在，不迁入本节的已结束记录集合。真实进程已经退出并沿 exited 收尾时，才适用本节。引擎或资源清理失败与记录失败分别呈现，不能用丢弃快照绕过尚未完成的必要清理。

<a id="organization"></a>

## 会话实现的组织

sessions 内部按 game、anime、comic 和 novel 划分产品会话，registry.ts 负责共同的实例登记与查找。各媒介拥有目标选择、打开、控制、实际观察、正式记录保存和关闭规则，内部文件按实际协作需要组织。

registry 保存尚在打开的目标占用与已经建立的会话登记，使并发打开、按 sessionId 控制和使用占用检查基于同一份运行事实。各媒介确定实际目标及适用约束，登记模块不解释进程监测、播放或阅读规则。占用不由另一模块维护副本，打开中的占用也不冒充已经成功建立的公开 Session。打开失败和正常结束都由实际拥有者完成清理与解除登记。

各媒介拥有单个会话的真实状态、内容观察和控制。registry 基于实际登记与这些状态提供公共 list、get、observeAll 和 observe，组合集合查询与变化观察。订阅的初始快照、后续变化与结束遵守[共同观察合同](#observation)。

新打开请求的共同接纳关口由 registry 维护，app 按[完整退出流程](../ui/navigation.md#shutdown)决定停止或恢复接纳。停止接纳拒绝新的目标占用申请，已经接纳的打开过程仍按实际结果及取消合同收尾，不能因内容尚未就绪而将其遗漏。单个会话的实际关闭归对应媒介，整个应用的退出等待与结果判断归 app，不在 registry 再建立一套退出流程。

漫画与小说共用阅读技术及已经同义的机制，作品上下文、内容导航和记录规则仍归对应媒介。技术执行与资源合同由 infrastructure.media、processes 及所接入的独立项目提供，不因会话分支而复制阅读内核，也不将 Work、Part 或持久记录规则下放到技术库。

app 将范围明确的占用检查能力注入 library，library 不反向导入 sessions。从异步打开到实际收尾，关联、路径和移除操作均使用真实占用依据。会话释放占用后，holdings 在自动刷新仍开启时重新核对受影响文件；实际使用结束、完成记录操作和游戏退出备份分别遵守各自的完整合同。
