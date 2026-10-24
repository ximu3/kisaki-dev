# VNDB Staff 主体类型验证

验证日期：2026-10-11。API 与官网页面的实际请求均返回 HTTP 200，保存在[人物与公司样本](2026-10-11-staff-types.json)和[团体与素材库样本](2026-10-11-staff-group-repository.json)中。页面证据只保留 Type 行，不复制完整页面。

| 主档案                | API 结果                                          | 官网 Type  | 本体对应 |
| --------------------- | ------------------------------------------------- | ---------- | -------- |
| s167，ZIZZ STUDIO     | /staff 返回该档案，gender 为 null，没有类型字段   | Company    | 组织     |
| s81，浅川 悠          | 已有身份样本确认该主档案及别名                    | Person     | 人物     |
| s557，Elements Garden | /staff 返回该主档案，gender 为 null，没有类型字段 | Group      | 组织     |
| s12140，魔王魂        | /staff 返回该主档案，gender 为 null，没有类型字段 | Repository | 组织     |

[当前 API 字段定义](2026-10-11-api-schema.json)的 /staff 没有主体类型字段。官网页面则存在 Type 行，以上四个档案分别覆盖 Person、Group、Company、Repository。不能仅靠 s 前缀、gender 为空或名称判断本体类型。

[源站编辑规范](https://vndb.org/d16#2)将 Staff 的主体范围描述为个人、群体、公司或游戏素材库，与四个页面中的分类相符。已将[类型读取规则](../../../design/extensions/sources/vndb.md#identities)写入来源设计：读取官网 Type，Person 进入人物，Group、Company 与 Repository 进入组织；素材库按独立署名的品牌或服务采用，读取失败不默认人物。

## 素材库的实际署名

v3727 的原版 staff 中包含 s12140，eid 为 null，role 为 music，note 为 BGM。这说明只筛原版职员并不能排除素材库条目，也不能因为源职责名为 Composer 就把素材库建立为人物。

已确认[素材提供署名规则](../../../design/extensions/sources/vndb.md#asset-providers)：有独立署名的素材品牌或服务作为组织收录，以 other 与“音乐素材提供”等说明保留实际参与，不仅凭素材被采用就推断其为本作直接创作。因此该样本对应组织 s12140 的 other 参与，保留音乐素材提供与 BGM 说明。本次样本没有核实具体素材作者、委托关系或授权情况。
