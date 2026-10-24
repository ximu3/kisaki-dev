# MangaDex 公开资料与个人接口合同核验

验证日期：2026-10-15。核对官方文档、OpenAPI、公开认证发现文档及实际匿名资料响应；没有取得用户凭据、执行本人登录或调用私人写入。[结构化记录](2026-10-15-public-contracts.json)仅保留必要公开结果，不保存章节图片、上传者信息或认证值。

## 文档与版本

官方文档仓库固定于 [60a3bb3c9f25675435a479c925d857015201739e](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/tree/60a3bb3c9f25675435a479c925d857015201739e)。[OpenAPI](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/static/api.yaml)为 195,189 字节，SHA-256 为 `004031ccdfc4b66727dd1f85d09b5300cf60235bbab2de6f6ea4816094bd6d33`。API /ping 和 [OIDC 发现文档](https://auth.mangadex.org/realms/mangadex/.well-known/openid-configuration)均正常返回。

## 账号接入范围

[认证说明](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/02-authentication/index.md)和[公共客户端说明](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/02-authentication/public-clients.md)仍将 public clients 标为尚未开放。发现文档列出授权码能力，不证明普通应用已经可以注册和使用公共客户端。

[个人客户端](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/02-authentication/personal-clients.md)只能用于拥有该客户端的账号。用户在站点设置中申请，只有获批或激活后才能使用；登录使用自己的 client ID、client secret、用户名和密码，通过表单提交 password grant，随后使用刷新令牌。文档明确说明此模式不执行账号的多因素交互。不能发布一个共享个人客户端供所有用户登录，也不能称为普通浏览器 OAuth 授权。

公开资料不要求登录。文档要求只在必要接口使用认证头，并且不得将认证头发送至封面、章节图片等资源域名。

## 漫画与发布记录样本

匿名搜索 Yotsuba，限定 safe 内容，返回 total=22，本次取三项。随后读取漫画 `58be6aa6-06cb-4ca5-bd20-f1392ce451fb` 的详情、aggregate、首批 feed、两条同组章节、五张封面的元数据，以及关联作者档案，全部返回 HTTP 200。搜索、feed 与封面仅读取样本页，不宣称已完成这些接口的全量分页验收。

该漫画主标题是 ja-ro 的 Yotsuba to!，originalLanguage 为 ja。主标题不自动等于原文标题；译名、原名与原作语言须分别解释。year 只给出年份，lastVolume、lastChapter 是来源末尾标号，不等于卷数或话数；创建、上传及可读时间也不是原作发表日期。

本次 aggregate 返回 16 个卷分组、133 个卷话分组，feed 的 total 为 782 条发布记录。卷 1 话 1 的组中有一个 id 和九个 others；直接读取其中两条 UUID，均声明卷 1、话 1，但译文语言分别为 vi 与 pt-br，页数分别为 49 与 54。因此，每个发布 UUID 不应直接成为一个独立的本地话，发布页数也不能当作原作声明页数。

aggregate 按卷、话提供分组以及实际 chapter UUID，并接受译文语言、翻译组和 includeUnavailable 过滤。漫画还提供 chapterNumbersResetOnNewVolume。卷与话号缺席、重置编号、版本分组和无法对应的条目仍需要明确采用规则；聚合本身不证明社区录入始终正确。

封面资源具有自己的 UUID、volume、locale 和图片文件名，但资源身份表示封面，不是卷身份。卷字段没有独立卷 UUID，不能拿封面 ID、卷号或数组位置伪造卷的来源身份。

## 作者资源的主体类型

作者 Azuma Kiyohiko 的记录和 CLAMP 都以 author 资源返回。CLAMP 的档案 `60bc549c-f2ac-488e-9b83-c840a76d17ce` 在简介中明确说明其创作团体性质，并列出成员；本次 name=CLAMP 搜索只有这一项。

AuthorAttributes 包含 name、biography、imageUrl、网站和技术时间，没有个人／组织类型字段。漫画关系中的 author、artist 表达职责，不是主体类别。把所有 author 资源无条件转为 Person 会错误归类已实际出现的创作团体；如何采用这类主体需要在逐项设计中明确，不能留给实施者猜测。

## 个人记录与操作合同

| 能力         | 官方合同                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------- |
| 本人关注漫画 | GET /user/follows/manga；关注与取消使用单独端点，不是评分或阅读状态字段                            |
| 阅读状态     | GET /manga/status 和 /manga/<id>/status；POST 单个 status，明确支持 null 撤回状态                  |
| 状态值       | reading、on_hold、plan_to_read、dropped、re_reading、completed                                     |
| 本人评分     | GET /rating 必须提供漫画 ID 范围；写入整数 1–10，DELETE /rating/<mangaId> 撤回评分                 |
| 已读标记     | GET /manga/<id>/read 返回 chapter UUID；POST 同一路径分别提交 chapterIdsRead、chapterIdsUnread     |
| 阅读历史     | 已读写入可额外指定 updateHistory；文档将此参数描述为把章节加入阅读历史，标记同步不能无意增加此行为 |
| 自定义列表   | 提供本人列表、关注列表、单个列表和成员接口；有公开性及版本字段，创建、修改、删除是独立平台操作     |

关注、状态、评分、自定义列表与分话标记各有自己的请求，不存在一份可以无条件整体回传的统一收藏记录。个人评分返回的 createdAt 是评分记录时间；这些合同没有作品完成日期或逐次完成历史。

普通集合分页受 offset 与单次数量限制，文档规定 offset 加数量不能超过 10,000。来源范围超过可完整查询范围时，不能把截断数据交付为完整清单。具体分组、过滤、清空和同步方向仍由本项目的逐项设计确定。

## 结论边界

本轮证据确认了公开读取、实际版本重复、作者类型缺项及个人接口的声明范围。账号申请获批、登录、刷新、本人数据完整性、读写副作用及写后核对均未实测。MangaDex 的[逐项设计](../../../design/extensions/sources/mangadex.md)讨论已经完成，接口可调用或文档存在不代表整项扩展已经完成实现或通过验收。
