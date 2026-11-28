# 本地资料库、持有与个人记录验收

<a id="six-targets"></a>

## 桌面六目标与候选制品

2026-11-28，开发分支的提交 `46a699a9` 在 Windows、macOS 和 Linux 的 x64、arm64 宿主分别通过 `@kisaki3/desktop#verify`。每个目标运行原生与数据库测试、源码开发会话、真实 Electron 窗口、性能场景及打包应用。表中的 SHA-256 对应实际启动并读回动画分集和媒体信息的归档。[六目标 CI](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143) · [实施提交](https://github.com/ximu3/kisaki-dev/commit/46a699a90850b06c6f71df878eda0cd1c0e85661)

| 目标与运行日志 | 实际运行制品 | 窗口用例（通过 / 按宿主条件跳过） | 制品 SHA-256 |
| --- | --- | ---: | --- |
| [Windows x64](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143/job/140889442765) | ZIP 中的程序 | 30 / 2 | `bc8d337027948ec6a3c733017e761f903d2a0c6c7ea7b21851744d4d3bece12f` |
| [Windows arm64](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143/job/140889442829) | ZIP 中的程序 | 30 / 2 | `13bd382c9844b5f7572f600a954438cd6042a2d557fc730a481ba1ab6c12ae10` |
| [macOS x64](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143/job/140889442783) | ZIP 中的 .app | 27 / 5 | `19e01c0a0ed6c9e5b602b4a190ea53104f4e7947f3ddb18debc78b3c199bd413` |
| [macOS arm64](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143/job/140889442781) | ZIP 中的 .app | 27 / 5 | `caedb5a6459cf38fc23e62ac40a3da0af9591d9c1a280756e451f8044b9cfe9f` |
| [Linux x64](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143/job/140889442778) | AppImage | 30 / 2 | `dd7c0c66670c6473335cd4be7a35642b0c9dd816ba72696f7c7e232b3bcace7c` |
| [Linux arm64](https://github.com/ximu3/kisaki-dev/actions/runs/46115849143/job/140889442756) | AppImage | 30 / 2 | `03bc73793a63d6b995fdb77f4e77d24566513ffb5de31303d2a73b45c676f3e8` |

本机使用 Windows 10 x64。全仓检查 45 项通过，桌面完整验证 20 项通过。其中原生与数据库 38 项、源码开发会话 6 项、真实窗口 28 项、性能场景 2 项和候选制品 1 项通过。另有 4 项窗口用例按宿主条件跳过。桌面合同包、公共 UI 包与本地化包的独立验证分别通过 12、9 和 15 项。

## 详情外壳、返回位置与关联写入

在 Windows x64 的旧 Kisaki 开发窗口从现有游戏打开角色，再从角色的相关作品打开游戏弹窗。页面和弹窗共用封面、概览和标签正文，页面操作在页头，弹窗操作在固定底部。新窗口用隔离资料库从展示柜的弹窗区块打开游戏，切换笔记并关闭后仍回到原区块。两端采用默认主题和 100% 应用缩放，游戏弹窗测得的客户区均为 782 × 670 CSS 像素。新窗口在最小尺寸、75%、100% 和 200% 缩放下均可切换标签并使用底部操作。[页面与弹窗](../../../../clients/desktop/app/tests/integration/electron/library/navigation.test.ts)

在有 1,200 个收藏条目的表格中翻到第二页，从第 80 行打开作品。返回后按该条目的身份重新定位，原行可见并保持选中。同一个不存在的目录分别经过普通登记和资料图登记准备，均由窗口错误编码器返回 `FileUnavailable`。[窗口返回](../../../../clients/desktop/app/tests/integration/electron/library/navigation.test.ts) · [目录错误](../../../../clients/desktop/app/tests/integration/library/holdings/registration.test.ts)

合并两个标签，保留标签侧与条目侧各自的排列，在同一事务中把动态合集和展示柜查询中的旧引用改指保留标签，按目标身份去重并保存名称。[标签与保存查询](../../../../clients/desktop/app/tests/integration/library/catalog.test.ts)

## 目录重新定位

在独立资料目录中建立小说及 A、B 两个内容目录。A 包含两本 TXT 读物，B 有一本同名但内容不同的读物。选 B 作为 A 的新位置后，报告只列出根目录冲突，已更新项目为空。数据库内的所有登记与操作前完全一致，B 的文件内容保持原值。

随后把 A 移到 C，再把一本读物移出 C。重试后，根目录和仍在 C 中的读物一起提交，读物的 ID 与笔记得以保留。缺失文件仍以原 ID 登记在 A，报告给出未能核实的目标。另在真实游戏配置与动画外部字幕上核对了同一边界。新根冲突时两个对象均保持完整原值；重试成功后，字幕延迟和未选中的游戏存档路径保持原值。实际 Electron 窗口从作品详情打开目录管理，依次选取 B、C，分别显示冲突和部分成功。自动化仅替代系统文件选择框返回选择的路径。[数据库与文件系统](../../../../clients/desktop/app/tests/integration/library/holdings/relocation.test.ts) · [正式窗口](../../../../clients/desktop/app/tests/integration/electron/library/holdings/relocation.test.ts)

## 启动配置与文件识别

登记不存在的游戏启动文件时，窗口错误编码保留 `FileUnavailable`。在 Windows x64 的隔离窗口创建启动配置并设为首选，重载后仍可从原游戏读回配置及首选状态。[登记错误](../../../../clients/desktop/app/tests/integration/library/holdings/registration.test.ts)

在漫画下建立编号为 2 的卷，将作品话号 13 的话收录为卷内话号 01。登记包含 `Vol.02/Vol.2 Ch.01.txt` 的内容目录后，内置规则匹配到这一个话 ID，文件保存的直接关联也指向它。换成不同卷号时仍报告冲突。[编号比较用例](../../../../clients/desktop/app/tests/integration/library/holdings/recognition.test.ts)

## 资料图与署名

同一个图创建作品、人物、角色和配音署名。单独更换有配音署名的作品角色端点时，数据库拒绝提交，同图较早的作品改名也回滚。显式迁移后，角色关联和署名的 ID 及署名说明均保留。显式删除署名后再更正角色也可提交。另一份图创建小说、卷、标签以及真实 TXT 文件，卷的完成状态和该文件的首选关联同次保存。[数据库场景](../../../../clients/desktop/app/tests/integration/library/graph.test.ts)

在 Windows x64 的独立数据库中，动画分集改为附加内容后保留原 ID、名称和完成状态。漫画卷合并后，卷内话号 01 仍指向作品话号 13 的同一话。游戏的开发组织署名可按原关系 ID 读回；录入反向作品关系后，从规范方向读取、按原 ID 修改备注均成功。

## 作品详情、完成记录与展示柜

实际 Electron 窗口从侧栏添加游戏，在详情中编辑原名，通过状态菜单记录一次完成和备注，再从展示柜管理器选择最近添加预设。重载后从展示柜打开作品，原名、完成次数和备注均可读回。[正式窗口场景](../../../../clients/desktop/app/tests/integration/electron/library/entries.test.ts)

## 混合选择与批量操作

在 Explorer 中打开游戏，再用 Ctrl 或 Cmd 加选人物。右键人物后菜单仍显示两项，可以为两项添加同一标签，作品状态动作禁用。右键尚未选中的小说后只选中小说，详情仍显示游戏。选中游戏和小说后，用键盘打开菜单，记录本次完成；重读数据库，两部作品各有一条完成明细，当前状态均已清除。另在收藏页全选三种类型的条目，切换到表格后对勾和右键菜单仍对应原来的三项。[实际窗口与落盘结果](../../../../clients/desktop/app/tests/integration/electron/library/selection.test.ts)

旧版 `features/library/components/explorer/explorer-list-item.vue` 将行导航与右键菜单分开，`components/shared/entity/menus/batch-menu-items.vue` 将选择数量、合集、收藏及删除动作分段显示。在旧版开发窗口选中两项后打开菜单，依次看到选择数量、合集、收藏和删除动作。两个版本的窗口中，菜单均使用 14 CSS 像素的基准字号、分隔线和 MDI 图标。新版增加的标签、作品状态和合并按现行资料模型显示。菜单打开时固定去重后的条目集合，按现行合同判定各动作的适用类型。

## 动画媒体信息

在 Electron Node 模式下以独立 libmpv 实例打开专用 Matroska 样本，可读出 FFV1 视频的 160 × 90 分辨率、一秒时长、PCM 音轨及 0 和 0.5 秒的章节起点。[媒体读取场景](../../../../clients/desktop/app/tests/integration/library/holdings/video.test.ts) · [固定制品](../w08/README.md#handoff)

## 规则草稿与目录方案

在小说详情新建编号为 1 的卷，登记实际含有 `01.txt` 的目录。在目录编辑器里进入方案管理，从卷号预设建立草稿，并选择该文件测试。窗口显示草稿规则及匹配的卷。保存方案并关闭管理器后，目录草稿仍选择内置规则。显式选用并保存目录后，从文件菜单测试同一登记，窗口显示已保存方案及匹配卷。[正式窗口场景](../../../../clients/desktop/app/tests/integration/electron/library/holdings/recognition.test.ts)

## 远处定位与返回

专用资料库内有 1,200 个游戏。滚动到展示柜末尾，打开最后一张卡片；Explorer 随当前查询定位到第 1,200 项，在可见区显示且只标记一个当前实例。返回后，展示柜按条目 ID 重新定位原卡片，首屏区间外的旧卡片没有一并挂载。[真实窗口与资料库](../../../../clients/desktop/app/tests/integration/electron/library/navigation.test.ts)

在同一份 1,200 项样本的 Windows x64 窗口中，选中首项，用 End 将焦点移到末项，再 Shift 点击末项，页脚显示选中 1,200 项。清除后折叠整组，在组头全选，仍取得 1,200 个真实条目。随后输入新的检索词，旧选择清空。

## 作品合并、删除与私人记录

将一本已有笔记、分部、完成明细、阅读活动及标注的小说并入另一本小说。两者都已登记同一份磁盘文件。提交后，目标保留原有个人值，分部及活动 ID 保留，标注改指目标文件，笔记仍为独立对象。随后删除目标小说，笔记可单独读取，磁盘文件仍保存原文。在正式窗口另从作品详情补录活动，并从笔记详情读回关联作品。[数据库与真实文件](../../../../clients/desktop/app/tests/integration/library/merge-delete.test.ts) · [正式窗口](../../../../clients/desktop/app/tests/integration/electron/library/records.test.ts)

## 自动维护、媒体与图片资源

从作品登记包含子目录链接的内容目录。在实际文件系统新增小说文件，正式窗口自动显示登记。关闭自动刷新后在盘上改名，重新开启后旧登记显示失联，并新增新位置；链接另一端的文件未被发现。[目录监听窗口场景](../../../../clients/desktop/app/tests/integration/electron/library/holdings/watch.test.ts)

动画详情中切换分集与附加内容时，分集编号草稿保留；登记真实的 Matroska 文件后，文件详情显示两条轨道、实际分辨率和章节。封面编辑从系统文件选择器取得源图，采用 48 × 64 裁剪并保存，窗口重载后读取正式附件仍得到相同尺寸。[媒体详情](../../../../clients/desktop/app/tests/integration/electron/library/holdings/video.test.ts) · [图片准备与重开](../../../../clients/desktop/app/tests/integration/electron/library/images.test.ts)

从候选归档解出的应用启动后，向隔离库登记动画内容目录及只匹配样本名称的方案；再次启动同一个候选应用，由自动维护读取视频并采用规则。直接从落盘数据库核对 160 × 90 分辨率、一秒时长和指定分集关联。该场景同时覆盖随包的媒体运行时、ASAR 内的规则 worker 和真实数据库重开。[候选载体验证](../../../../clients/desktop/app/tests/artifacts/desktop.test.ts)

## 已核对的桌面布局

旧工程的 `components/ui/page-header`、`components/shared/game/detail/detail-hero.vue` 和 `tabs/overview-tab.vue` 分别定义页头图标尺寸、摘要两列及概览的 3∶1 分栏。在 100% 应用缩放下对照旧版开发窗口和隔离的新窗口。两版的媒体库标题起点约为 x=87.5，展示柜区块起点为 x=283.5；作品封面宽 7rem，摘要和概览在宽窗口均呈两列。旧版视口为 1379 × 783，新版按相同窗口尺寸设置后测得 1380 × 784 CSS 像素。旧窗口以原有资料显示，隔离的新窗口使用专用样本。

实际窗口还核对了展示柜区块管理、合集列表与统计总览。在最小窗口中分别通过偏好设置保存 75% 与 200% 缩放，关闭偏好后仍能访问展示柜卡片。缩放检查只覆盖所列页面。
