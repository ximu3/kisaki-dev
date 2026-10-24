# Bangumi 个人操作与接口边界

验证日期：2026-10-13。[观察数据](2026-10-13-account-operations.json)记录固定版官方 schema、官方服务端与认证说明的版本和哈希，以及匿名只读请求。未读取或使用用户凭据，没有执行收藏、评分、状态或目录写入；代码行为与线上账号验收分别记录。

## 本人范围与分页

匿名 GET /v0/me、本人整部章节收藏与单章节收藏均返回 401。这只能证明这些读取入口要求认证，不能代替连接、刷新或私密收藏验收。本人操作使用核验后的账号；公开名单不能证明查询者就是名单所有人。

subject 收藏列表和单项详情包含 type、rate、tags、comment、ep_status、vol_status、private 与 updated_at，没有独立 favorite 或完成日期字段。单项 404 的说明同时包含不存在、未收藏和私有收藏，不能在缺少适当授权时统一解释为没有记录。schema 明确指出 updated_at 不是收藏日期。

官方 schema 的人物与角色收藏列表未列出 limit、offset 参数，服务端处理器实际读取这两个分页值。匿名公开样本各请求 offset = 0、1，均返回 limit = 1 与相应 offset，且两页的对象 ID 不同。人物列表 total 为 59，角色列表 total 为 45；仅验证这两页，不宣称完成了完整账号清单读取。

## 作品状态、评分与创建副作用

subject 收藏 type 接受 1–5，不包含空状态；rate 接受 0–10，其中 0 表示删除评分。POST 可创建或更新，PATCH 修改已有记录，各请求字段可选；tags 缺席或 null 不修改，空数组则清空。

固定版[服务端持久化实现](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/internal/collections/infra/mysql_repo.go)在新建收藏时预设 Doing，即 type = 3。只发送评分而不发送状态，会沿这项默认值创建记录，不能将“请求没带 type”理解为没有状态副作用。未明确提供 private 时，新对象也不是自动私密。

固定版[评分模型](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/internal/collections/domain/collection/subject.go)在当前状态为 Wish 时，把提交的评分设置为 0。控制器先应用所选 type，再应用 rate。因此同时写入 type = 1 与正评分，不能按请求负载宣称两个值都已保存。单独修改 type 的路径不等于提交 rate，这也不能被扩大解释为所有已有 Wish 记录必定没有评分。

POST 的 schema 写明 204，而当前服务端处理器返回 202。此处只记录文档与代码差异，没有实测授权 POST；账号验证须回读实际值，不能仅凭预期 HTTP 状态宣称字段同步成功。

## 分集标记与书籍数量

EpisodeCollectionType 明确包含 0 未收藏、1 想看、2 看过、3 抛弃。支持按 episode 身份读取与写入，也支持在一个 subject 下按指定 ID 批量写入。整部章节收藏列表支持分页与 episode_type，普通分集、SP 和其他章节的对象范围仍须分别核对。

单项和批量更新都要求父 subject 已在本人收藏中。[章节更新控制器](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/ctrl/update_episode_progress.go)核对实际归属并更新章节记录，再重算父记录的 ep_status；所读代码没有在此步骤调用作品状态修改。计数不能代替各 episode 的真实完成值，也不能据此生成本地作品完成历史。

书籍的 vol_status 与 ep_status 是两个非负数量。API 与处理器都只允许通过 subject 收藏接口修改书籍的这两个值；非书籍直接提交数量会被拒绝。所读模型分别保存数字，没有同时返回或建立各卷、话的完成身份。这些材料没有证明“已读 N 项”一定表示目录连续前 N 项，也不能证明不同版本或附加卷包含在同一范围。

实际单卷 subject 的个人状态仍遵守 subject 收藏枚举，不能借用 episode 的 0 值撤回单卷完成。单卷状态、整部书籍数量与作品状态是三项不同资料，不能用任意一项覆盖另外两项。

## 人物、角色收藏与目录

[固定 v0 schema](https://github.com/bangumi/api/blob/a7055f2dca7286d6963aaa7928345eeca6293e2b/open-api/v0.yaml)为人物和角色的 collect 路径都声明 POST 与 DELETE。当前[官方路由代码](https://github.com/bangumi/server/blob/4223d14057fea5078595e40470f8602d3301abb5/web/routes.go)登记了 POST，DELETE 则处于等待软删除的注释中。两者存在实际差异，不能只看 schema 就宣称撤回收藏已可用。

对上述 collect 地址发出的匿名 GET 均返回 404，未返回 Allow；GET 不属于这两个写入方法，所以此结果不能证明 POST 或 DELETE 的线上可用性。后续[授权账号验证](authenticated-collections.md)实际执行了角色重复收藏、未收藏对象的取消请求和非法编号的路由对照：POST 可调用或进入参数校验，DELETE 返回默认 404。未新增无法撤回的收藏，原记录保持不变；该验证不等于完成了新增后撤回的闭环。

目录 API 支持按编号读取目录与完整分页的 subject 成员，以及有权限时创建、编辑目录和成员、收藏或取消收藏目录。索引收藏不是作品 favorite。目录 subject 仍可能是单卷或本体不支持的对象，来源成员记录不能自行扩大本体合集只收纳 Entry 的范围。

## 授权与尚需验证的行为

官方[用户授权说明](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md)给出 authorization_code、client_secret、60 秒 code 窗口和 refresh_token 流程；v0 使用 Authorization header，不接收 query token。该说明中的 scope 注释与当前服务端范围检查不能简单当作同一版本的保证。Kisaki 仍沿已确定的 relay 与 loopback 合同接入，不把应用秘密放入桌面扩展。

[正式写入规则](../../../design/extensions/sources/bangumi.md#personal-writes)按 2026-10-16 确认的共同规则接受评分创建时的原生 Doing 默认值；分集写入重算父计数也正常接受。单独分集操作仍不能另建未选父记录，Wish 下无法保存的正评分也不能以其他状态替代。人物／角色收藏取消路由的限制仍由专项授权验证确认。上述材料不表示已完成作品记录读写、完整分页、可见性、刷新或扩展运行验收。
