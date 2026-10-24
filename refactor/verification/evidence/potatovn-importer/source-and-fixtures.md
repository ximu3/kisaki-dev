# PotatoVN 源码与合成格式核验

核验日期：2026-10-17。固定基线为 v1.10.2.0，提交 d877bbe166e5b71d6520784f9d268e6df7eb4487；查询时最新正式发布仍为该版本，发布时间为 2026-08-02。用户表示没有现成备份，本次使用源码与合成样本，未运行 PotatoVN 或读取真实用户库。

[完整接入方案](../../../design/extensions/importers/potatovn.md)已确认。[结构化记录](2026-10-17-verification.json)包含公开源文件地址、校验值、合成输入和验证边界；[检查结果](synthetic-results.json)区分格式读取及方案规定的转换检查。下述游戏、安装和图片数量全部来自合成夹具，不是用户数据统计。

## 导出格式

[ExportTask](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Models/BgTasks/ExportTask.cs)依次导出游戏、游戏库、分类、职员、数据状态及页面设置，再使用标准 ZIP 压缩。[LocalSettingsService](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Services/LocalSettingsService.cs)写入 data.{key}.json，图片复制到 Images 并返回 .\Images\... 相对引用。

当前运行数据库使用 LiteDB，但全库导出仍是普通 JSON。[LocalSettingStatus.SetToExport](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Models/LocalSettingStatus.cs)会将数据库化、已导入及多安装升级等标志重置。不能将这些 false 当作损坏输入，也不能直接执行来源的升级流程。

[FileService](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.Core/Services/FileService.cs)使用 Newtonsoft.Json 序列化，相关导出没有启用 TypeNameHandling。LockableProperty 形成 Value / IsLock 对象，枚举使用数值。源库的[游戏关联转换器](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Helpers/JsonConverters/GalgameAndUidConverter.cs)写入游戏 Uuid 字符串，不把完整 Galgame 再嵌入每个库和分类。

单游戏采用 [GameMetaBackup](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Models/GameMetaBackup.cs) Version 2，分别保存 Game 和 Installation。[LocalFolderSourceService](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Services/SourceService/LocalFolderSourceService.cs)写 meta.json 及图片；[SteamSourceService](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Services/SourceService/SteamSourceService.cs)会把这些文件集中写入 steamapps/.PotatoVN 下，元数据父目录因此不必等于安装目录。

单游戏背景图保存逻辑使用游戏名构造复制文件名，却可能把原图片 basename 写入 HeaderImagePath。只有源码不能断言所有实际备份都受影响；本次用缺失引用与另一张相似命名图片的夹具验证不会自动替换。完整格式识别仍须在实际导出和正式导入器中验收。

## 记录和身份含义

[Galgame](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.WinApp.Base/Models/Galgame.cs)将 MyRate、Comment、PlayType、PlayedTime、TotalPlayTime 与资料 Rating 分开保存。[评分编辑](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Views/Dialog/ChangePlayStatusDialog.xaml.cs)提供 0–10 整数选项；[显示转换器](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Views/GalgamePagePanel/GamePlayStatusPanel.xaml.cs)将 0 显示为未评分占位，而非有效零分。

[PlayType](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.WinApp.Base/Enums/PlayType.cs)依次为 None、Playing、Played、Shelved、Abandoned、WantToPlay。[RecordPlayTimeTask](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Models/BgTasks/RecordPlayTimeTask.cs)每个有效分钟增加总量和当天值，一次游玩达到阈值后才增加 PlayCount。因此 PlayCount 也不是完成次数。

[时长编辑](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Views/Dialog/EditPlayTimeDialog.xaml.cs)按日值重算总量，游戏合并同样可以重算。来源实际上保存两份字段，不能将 TotalPlayTime 描述为所有情况下实时计算的只读属性。接入方案选择明确总量作为本次迁入值，缺席时才由日值求和，是本项采用政策；不会叠加两份值或恢复虚构区间。

Comment 的编辑和显示均按普通文字处理。[简介面板](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Views/GalgamePagePanel/GameDescriptionPanel.xaml)也直接显示 Description.Value，不将其当 HTML。源文字进入 Markdown 时应保持原本可见的字面内容。

[RssType](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.WinApp.Base/Enums/RssType.cs)确定 Ids 的位置；[VNDB 读取实现](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Helpers/Phrase/VndbPhraser.cs)允许并保留 r 编号。本项因此只把有效 VN 编号转换为游戏身份，不把 r 改成 v。其他正式身份沿本体 Bangumi、YMGal、Steam 合同规范化，内部 Uuid 和插件槽位保持本次关联用途。

## 分类与本地安装

[CategoryGroupType](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Enums/CategoryGroupType.cs)区分 Developer、Status、Custom、Engine。分类导出包含这些组，不能把全部内容都解释为用户手动合集。Category 的 GalgamesX 与 GalgameIds 表达同一批成员，不双重采用。

[GalgameAndPath 与 LocalInstallationConfig](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.WinApp.Base/Models/Sources/GalgameAndPath.cs)明确区分逻辑游戏、安装 EntryId 和配置。LocalFolder 与 Steam 是本地安装；LocalZip 和 Virtual 不是安装。根 Galgame 仍有兼容属性，读取具体安装时必须使用其 LocalConfig，不把首选安装的镜像复制给其他安装。

[GameLaunchService](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Services/GameLaunchService.cs)把 installation.Path 作为工作目录，并对整个 ExeArguments 调用一次 ArgumentList.Add；这与拆成多个参数不同。转区模式将执行目标换成全局工具路径，并只传游戏执行文件；RunAsAdmin 使用 runas。启动成功还会更新 PreferredInstallationId，它不能证明用户设置过一个不随运行变化的人工首选。

[GamePortablePath](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.WinApp.Base/Helpers/GamePortablePath.cs)保存 Mapping 与 ParsedPath，允许游戏根和已知用户目录标签。[设置页面](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/ViewModels/GalgameSettingViewModel.cs)也允许用户更正 DetectedSavePath，不应仅因名称带 Detected 就丢弃它。本次没有读取实际执行文件、移动存档、创建链接、请求管理员权限或运行转区工具。

## 合成夹具与检查

[JSON 夹具目录](fixture)包含 6 个逻辑游戏、6 种状态、5 个库、7 个库条目，其中 5 个本地安装，一作具有两份安装；另有自定义和自动分类、一个职员及一个角色。所有名称、UUID、评论、执行参数和本地路径都是测试数据。

[全库 ZIP](synthetic.pvnExport.zip)由这些 JSON 与 7 个合成图片文件构造；[Version 2 元数据](meta-v2/meta.json)使用同一游戏的一份独立安装。故意缺少其背景图引用所指文件，另放置一个不同文件名的图片，用于验证缺失资源不被猜测替代。

[生成脚本](build-fixture.mjs)与[验证脚本](verify.mjs)使用仓库现有 fflate 0.8.3，无需运行源程序或安装 .NET。验证 ZIP 展开、字段包装、身份位置、状态及评分、分钟换算、多安装关联、单参数文本、自定义分类、StaffGame 引用、Version 2、路径范围、图片字节和输入校验值。当前 41 项检查全部通过，覆盖 7 个图片文件的 17 个库内引用；单游戏样本另有一项预设的缺失引用。结果包含方案规定的纯转换检查，不是正式业务代码或端到端导入测试。

在仓库根目录使用 Node 执行脚本，并将 node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs 作为第一个参数；先运行 build-fixture.mjs，再运行 verify.mjs。ZIP 只写到本证据目录，生成器不扫描其他文件。图片检查只验证引用和原字节，不宣称完整图像解码已通过。

本次没有真实用户备份，因此不能据此证明其历史数据完整、所有实际导出都符合这些样本，或 Windows 命令转换已经可用。资料方案、本体写入、资源准备、真实启动参数与管理员／转区命令、界面、取消和最终制品都仍须实现验收。合成文件保留为本方案的复现材料，未产生用户数据库副本。
