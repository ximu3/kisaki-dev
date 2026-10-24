# VNDB 职员职责与备注验证

验证日期：2026-10-11。[当前 API 字段定义](2026-10-11-api-schema.json)列出十个 staff_role 值。[作品编辑规范 Staff 节](https://vndb.org/d2#3.1)于同日直接读取返回 HTTP 200，要求类别不足以表达具体工作时通过备注说明，并允许同一主体具有多项职责。

## 来源职责

| 来源值     | 来源称谓          | 核实的解释边界                           |
| ---------- | ----------------- | ---------------------------------------- |
| scenario   | Scenario          | 脚本工作，与 director 分开               |
| director   | Director          | 游戏创作中的职责，不用于翻译团队负责人   |
| chardesign | Character design  | 角色设计，与 art 分开                    |
| art        | Artist            | 宽泛的美术类别，具体工作可在备注中说明   |
| music      | Composer          | 需结合备注保留作曲、编曲等实际工作       |
| songs      | Vocals            | 音乐中的演唱，与角色配音分开             |
| translator | Translator        | 翻译职责，仍受已确定的原版职员范围限制   |
| editor     | Editor            | 文字编辑；规范将图像编辑归入 staff       |
| qa         | Quality assurance | 包括测试、除错与校对等，不等同于程序编写 |
| staff      | Staff             | 其他工作，具体职责通过备注说明           |

这些源类别不是本体职责枚举。主体类型、作品范围与实际工作含义都需要参与映射，Repository 按已确认的[素材提供规则](../../../design/extensions/sources/vndb.md#asset-providers)采用。

## 原版名单的实际备注

[已保存的 v17 原始响应](2026-10-11-edition-credits.json)中，下列记录的 eid 均为 null。这里展示的是来源原始称谓，不表示所有职责已完成映射。

| 主体                       | 来源职责 | 来源备注                               |
| -------------------------- | -------- | -------------------------------------- |
| s15719，Nakayama Hiroaki   | staff    | Programming                            |
| s12984，Ichikawa Hisayoshi | staff    | Executive producer                     |
| s548，Uchikoshi Koutarou   | staff    | Original concept, scenario composition |
| s1525，Ichikawa Kazuhiro   | staff    | Producer, OP movie                     |
| s9708，Nakazato Takeshi    | staff    | Storyboards, CG supervision            |
| s3664，Isoe Toshimichi     | music    | OP arrangement                         |
| s223，Matsuo Yukihiro      | art      | Character sprites, BG                  |
| s9276，Matsumoto Yuusuke   | staff    | Debug                                  |

本次另行读取 s15719 与 s12984 的公开档案，Type 均为 Person，HTTP 200；Type 行保存在[备注示例主体类型](2026-10-11-staff-role-subjects.json)中。两例分别具备采用人物 programmer 和 producer 的明确来源工作依据。

## 已确认的采用判断

已确认[职员职责映射](../../../design/extensions/sources/vndb.md#staff-roles)：采用来源备注中明确表达、且本体已有的职责。Programming 对应 programmer，Executive producer 对应 producer 并保留原始称谓；这两例不再同时生成笼统的 other。模糊文字仍按已有类别采用，无法进一步归类的实际参与保留 other 与原始说明，不能仅凭任意关键词建立职责。

十个类别在来源设计中分别列出人物与 Group／Company 的默认映射，Repository 仍先采用素材提供规则。已知细项保留在原职责下，例如 music＋OP arrangement 仍为 music；未说明含义的 Scripting 和 Debug 都不能自动认作 programmer。并列的明确独立工作可以分别采用，但不因拆分而复制笼统父类别。

来源备注的解释发生在资料适配阶段；本体关系 note 仍是供人阅读的说明，不反向驱动职责更新。本文证据尚未覆盖十个类别的全部实际样本、自由文本格式或所有组织职责。
