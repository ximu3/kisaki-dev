# 本地资料库、持有与个人记录验收

<a id="six-targets"></a>

## 桌面六目标与候选制品

2026-11-28，开发分支的提交 `139e7c97` 在 Windows、macOS 和 Linux 的 x64、arm64 宿主分别通过 `@kisaki3/desktop#verify`。每个目标运行原生与数据库测试、源码开发会话、真实 Electron 窗口、性能场景及打包应用。表中的 SHA-256 对应实际启动并读回动画分集和媒体信息的归档。[六目标 CI](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739) · [实施提交](https://github.com/ximu3/kisaki-dev/commit/139e7c97c6eb35d55f227d551c65346e64fb3575)

| 目标与运行日志 | 实际运行制品 | 窗口用例（通过 / 按宿主条件跳过） | 制品 SHA-256 |
| --- | --- | ---: | --- |
| [Windows x64](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739/job/140867424381) | ZIP 中的程序 | 30 / 2 | `e9c2a597a6513818ed7f27f826ca8d8fcfc216e9f3bbb0c38ef9f7a70cc293bf` |
| [Windows arm64](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739/job/140867424352) | ZIP 中的程序 | 30 / 2 | `ca060bd9df719688200fba1b3f4917eefcaf2aaedbdd756086ec24f18c4845f2` |
| [macOS x64](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739/job/140867424299) | ZIP 中的 .app | 27 / 5 | `e9f0a6fe4cafae75e6dc9cae44bbe803ead5221672632a713c57350418ea1715` |
| [macOS arm64](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739/job/140867424292) | ZIP 中的 .app | 27 / 5 | `5f27e4d1c7512d5516d90329a58b789bea5629cbdd31e09274400cb3d58ef735` |
| [Linux x64](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739/job/140867424340) | AppImage | 30 / 2 | `54706c3b96ad216d39c09ae0cbe340d6c9154188dfabdf63e1d3c84eeb238edf` |
| [Linux arm64](https://github.com/ximu3/kisaki-dev/actions/runs/46108758739/job/140867424343) | AppImage | 30 / 2 | `b1ae4d3e9070e05b76593920fcd0b1f459db2ffc7774d03ad5f736228286808a` |

本机使用 Windows 10 x64。全仓检查 45 项通过，桌面完整验证 20 项通过。其中原生与数据库 37 项、源码开发会话 6 项、真实窗口 28 项、性能场景 2 项和候选制品 1 项通过。另有 4 项窗口用例按宿主条件跳过。桌面合同包与本地化包的独立验证分别通过 12 项和 15 项。

## 目录重新定位

在独立资料目录中建立小说及 A、B 两个内容目录。A 包含两本 TXT 读物，B 有一本同名但内容不同的读物。选 B 作为 A 的新位置后，报告只列出根目录冲突，已更新项目为空。数据库内的所有登记与操作前完全一致，B 的文件内容保持原值。

随后把 A 移到 C，再把一本读物移出 C。重试后，根目录和仍在 C 中的读物一起提交，读物的 ID 与笔记得以保留。缺失文件仍以原 ID 登记在 A，报告给出未能核实的目标。另在真实游戏配置与动画外部字幕上核对了同一边界。新根冲突时两个对象均保持完整原值；重试成功后，字幕延迟和未选中的游戏存档路径保持原值。实际 Electron 窗口从作品详情打开目录管理，依次选取 B、C，分别显示冲突和部分成功。自动化仅替代系统文件选择框返回选择的路径。[数据库与文件系统](../../../../clients/desktop/app/tests/integration/library/relocation.test.ts) · [正式窗口](../../../../clients/desktop/app/tests/integration/electron/directory-relocation.test.ts)

## 资料图与署名

同一个图创建作品、人物、角色和配音署名。单独更换有配音署名的作品角色端点时，数据库拒绝提交，同图较早的作品改名也回滚。显式迁移后，角色关联和署名的 ID 及署名说明均保留。显式删除署名后再更正角色也可提交。另一份图创建小说、卷、标签以及真实 TXT 文件，卷的完成状态和该文件的首选关联同次保存。[数据库场景](../../../../clients/desktop/app/tests/integration/library/graph.test.ts)

## 作品详情、完成记录与展示柜

实际 Electron 窗口从侧栏添加游戏，在详情中编辑原名，通过状态菜单记录一次完成和备注，再从展示柜管理器选择最近添加预设。重载后从展示柜打开作品，原名、完成次数和备注均可读回。[正式窗口场景](../../../../clients/desktop/app/tests/integration/electron/library.test.ts)

## 混合选择与批量操作

在 Explorer 中打开游戏，再用 Ctrl 或 Cmd 加选人物。右键人物后菜单仍显示两项，可以为两项添加同一标签，作品状态动作禁用。右键尚未选中的小说后只选中小说，详情仍显示游戏。选中游戏和小说后，用键盘打开菜单，记录本次完成；重读数据库，两部作品各有一条完成明细，当前状态均已清除。另在收藏页全选三种类型的条目，切换到表格后对勾和右键菜单仍对应原来的三项。[实际窗口与落盘结果](../../../../clients/desktop/app/tests/integration/electron/library-batch.test.ts)

旧版 `features/library/components/explorer/explorer-list-item.vue` 将行导航与右键菜单分开，`components/shared/entity/menus/batch-menu-items.vue` 将选择数量、合集、收藏及删除动作分段显示。在旧版开发窗口选中两项后打开菜单，依次看到选择数量、合集、收藏和删除动作。两个版本的窗口中，菜单均使用 14 CSS 像素的基准字号、分隔线和 MDI 图标。新版增加的标签、作品状态和合并按现行资料模型显示。菜单打开时固定去重后的条目集合，按现行合同判定各动作的适用类型。

## 动画媒体信息

在 Electron Node 模式下以独立 libmpv 实例打开专用 Matroska 样本，可读出 FFV1 视频的 160 × 90 分辨率、一秒时长、PCM 音轨及 0 和 0.5 秒的章节起点。[媒体读取场景](../../../../clients/desktop/app/tests/integration/library/video.test.ts) · [固定制品](../w08/README.md#handoff)

## 规则草稿与目录方案

在小说详情新建编号为 1 的卷，登记实际含有 `01.txt` 的目录。在目录编辑器里进入方案管理，从卷号预设建立草稿，并选择该文件测试。窗口显示草稿规则及匹配的卷。保存方案并关闭管理器后，目录草稿仍选择内置规则。显式选用并保存目录后，从文件菜单测试同一登记，窗口显示已保存方案及匹配卷。[正式窗口场景](../../../../clients/desktop/app/tests/integration/electron/recognition-profile.test.ts)

## 远处定位与返回

专用资料库内有 1,200 个游戏。滚动到展示柜末尾，打开最后一张卡片；Explorer 随当前查询定位到第 1,200 项，在可见区显示且只标记一个当前实例。返回后，展示柜按条目 ID 重新定位原卡片，首屏区间外的旧卡片没有一并挂载。[真实窗口与资料库](../../../../clients/desktop/app/tests/integration/electron/library-navigation.test.ts)

在同一份 1,200 项样本的 Windows x64 窗口中，选中首项，用 End 将焦点移到末项，再 Shift 点击末项，页脚显示选中 1,200 项。清除后折叠整组，在组头全选，仍取得 1,200 个真实条目。随后输入新的检索词，旧选择清空。

## 作品合并、删除与私人记录

将一本已有笔记、分部、完成明细、阅读活动及标注的小说并入另一本小说。两者都已登记同一份磁盘文件。提交后，目标保留原有个人值，分部及活动 ID 保留，标注改指目标文件，笔记仍为独立对象。随后删除目标小说，笔记可单独读取，磁盘文件仍保存原文。在正式窗口另从作品详情补录活动，并从笔记详情读回关联作品。[数据库与真实文件](../../../../clients/desktop/app/tests/integration/library/entry-identity.test.ts) · [正式窗口](../../../../clients/desktop/app/tests/integration/electron/personal-records.test.ts)

## 自动维护、媒体与图片资源

从作品登记包含子目录链接的内容目录。在实际文件系统新增小说文件，正式窗口自动显示登记。关闭自动刷新后在盘上改名，重新开启后旧登记显示失联，并新增新位置；链接另一端的文件未被发现。[目录监听窗口场景](../../../../clients/desktop/app/tests/integration/electron/holdings-watch.test.ts)

动画详情中切换分集与附加内容时，分集编号草稿保留；登记真实的 Matroska 文件后，文件详情显示两条轨道、实际分辨率和章节。封面编辑从系统文件选择器取得源图，采用 48 × 64 裁剪并保存，窗口重载后读取正式附件仍得到相同尺寸。[媒体详情](../../../../clients/desktop/app/tests/integration/electron/library-video.test.ts) · [图片准备与重开](../../../../clients/desktop/app/tests/integration/electron/library-images.test.ts)

从候选归档解出的应用启动后，向隔离库登记动画内容目录及只匹配样本名称的方案；再次启动同一个候选应用，由自动维护读取视频并采用规则。直接从落盘数据库核对 160 × 90 分辨率、一秒时长和指定分集关联。该场景同时覆盖随包的媒体运行时、ASAR 内的规则 worker 和真实数据库重开。[候选载体验证](../../../../clients/desktop/app/tests/artifacts/desktop.test.ts)

## 已核对的桌面布局

旧工程的 `components/ui/page-header`、`components/shared/game/detail/detail-hero.vue` 和 `tabs/overview-tab.vue` 分别定义页头图标尺寸、摘要两列及概览的 3∶1 分栏。在 100% 应用缩放下对照旧版开发窗口和隔离的新窗口。两版的媒体库标题起点约为 x=87.5，展示柜区块起点为 x=283.5；作品封面宽 7rem，摘要和概览在宽窗口均呈两列。旧版视口为 1379 × 783，新版按相同窗口尺寸设置后测得 1380 × 784 CSS 像素。旧窗口以原有资料显示，隔离的新窗口使用专用样本。

实际窗口还核对了展示柜区块管理、合集列表与统计总览。在最小窗口中分别通过偏好设置保存 75% 与 200% 缩放，关闭偏好后仍能访问展示柜卡片。缩放检查只覆盖所列页面。
