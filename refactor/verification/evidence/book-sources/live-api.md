# Google Books 与 RanobeDB 来源核验

核验日期：2026-10-16。本组完整方案已确认，运行代码未改动。公开请求的状态、来源版本和字段事实见[结构化记录](2026-10-16-api.json)，限定写入另见[完整步骤](2026-10-16-google-books-writes.json)。材料不包含凭据、令牌、授权参数、账号编号、邮箱或私人正文。

## Google Books 授权与访问条件

| 检查项                              | 实际结果                                                               |
| ----------------------------------- | ---------------------------------------------------------------------- |
| 无项目凭据的 Volume 读取            | 429，报告配额为零                                                      |
| Kisaki Desktop 客户端               | 已创建；S256、动态 loopback，现有 Web 客户端未修改                     |
| 仅 client ID 的令牌交换             | 400，明确要求 client_secret                                            |
| 补齐正确桌面配置后的交换            | 200，取得访问与刷新令牌                                                |
| books-only 刷新                     | 200                                                                    |
| Kisaki Books API key                | 已创建，仅允许 Books API，没有绑定服务账号                             |
| 仅 API key 读取 Volume、名称检索    | 200，名称查询取得非空结果                                              |
| 仅 API key 读取 Series／membership  | 401，要求用户认证                                                      |
| books OAuth 读取 Series／membership | 200，成员分页成功                                                      |
| 稳定账号身份                        | Bookshelf.list／get 没有 selfLink，books-only tokeninfo 也没有 user_id |
| 补充 openid／email                  | 已完成，ID token 签名／nonce／账号校验及同账号刷新均通过               |

[现行桌面 OAuth 说明](https://developers.google.com/identity/protocols/oauth2/native-app)将 client_secret 列为可选，但本次 Desktop 客户端实际要求它。使用其正确桌面配置后交换成功，仍为 S256，不使用原 Web 客户端秘密。正式桌面配置不能被宣称为客户端能够保密的凭据；用户令牌继续独立保护。

Books Discovery revision 为 20261013，仅列出统一 books 管理范围，没有专用只读范围。官方旧说明建议从 Bookshelf.selfLink 取得 Books user ID；本次本人列表与单个书架均缺少该字段。正式 OAuth2 tokeninfo 请求返回应用、scope 和有效期，也没有用户标识，因此不能把此时的图书授权报告为已核验稳定身份。

已按用户同意取得 openid 与 email，验证 ID token 签名、issuer、audience、有效期与本次 nonce；刷新后 sub 保持一致，邮箱存在且已验证，实际书架读取返回 200。Google ID token.sub 标识 Google 账号，不冒充 Books user ID；没有请求 profile。一次过期回调被拒绝后已重新完成交互授权。

## Google Books 的对象范围

| 样本                                      | 实际观察                                                               | 设计影响                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| SAO 日文 CPlnPgAACAAJ                     | ja，352 页，ISBN 9784048677608，无 seriesInfo                          | 单卷书目及其版本资料，不证明不存在母体                     |
| SAO 繁中 y2orDwAAQBAJ                     | zh-TW，339 页，ISBN 9789862373996，无 seriesInfo                       | 版本语言不是原作语言                                       |
| SAO 英文 fBZVDgAAQBAJ                     | en，256 页，ISBN 9780316560856，有系列信息                             | 同一内容单元的不同出版记录不能直接当多个作品               |
| SAO 系列 NpBJHAAAABB-jM                   | ORDERED_COMICS_SERIES，成员为轻小说                                    | 系列枚举中的 COMICS 不能作为根类型判据                     |
| SAO 完整成员                              | 两页共 27 项，全部补读成功，均为英文轻小说；显示编号缺 22              | 不按数量补卷；编号 23 的 orderNumber 是 22，排序不等于卷号 |
| dxeYHAAAABDuCM                            | The Yoru Sumino Collection，七部独立小说，同样是 ORDERED_COMICS_SERIES | Series 也可以是作者作品集，不能统一建成一部 Novel          |
| 《我想吃掉你的胰脏》小说纸书 IqGQEAAAQBAJ | 标题明确 Light Novel，但类别为 Manga；ISBN 9781642750331，260 页       | 分类前缀也不能可靠区分漫画与小说                           |
| 同作小说电子书 Hr92DwAAQBAJ               | ISBN 9781642754889，257 页，归在上述作者作品集                         | 系列内的“1”不是这部小说的卷号                              |
| 同作漫画 RqGQEAAAQBAJ／YF9-DwAAQBAJ       | 漫画完整合集，442 页，各有自己的 ISBN                                  | 小说与漫画改编、整作与合订范围分别核对                     |
| 芙莉莲系列 vKusHAAAABARtM                 | 同一系列枚举，14 个漫画成员                                            | 有真实作品系列，也不能反推所有 Series 都有该含义           |

membership 的成员是简略 Volume，语言、分类、ISBN、页数等需要详情补读。普通轻小说的 seriesBookType 也是 COLLECTED_EDITION，不能只按该枚举认定合订。

SAO、芙莉莲、住野夜作品集的 bannerImageUrl 指向完全相同的图片。实际 GET 返回 JPEG、47059 字节，图片已查看，是通用蓝色漫画拼图，不是三部对象各自的背景；不把它写入作品 backdropImage。

## Google Books 检索与私人记录

API key 下普通名称检索可取得非空结果，SAO 查询报告 167 项，Frieren 查询报告 336 项。相同环境下，多个详情中确实存在的 ISBN，包括当前名称检索结果的 ISBN，使用 isbn: 查询仍返回 totalItems=0；一个不带限定词的 ISBN 查询同样为零。不能将这一差异归为全部检索不可用，也不能据零项断言已知书目不存在。

本人十个书架均已读取。0 Favorites、2 To Read、3 Reading Now、4 Have Read 为 PUBLIC；系统及自定义书架编号依本账号解释，任意分类与购买不等同喜爱或读过。

用户明确同意后，只用 fBZVDgAAQBAJ 执行了以下 9 次写入，全部返回 200：

1. 加入 Favorites，再重复加入一次；成员仍只有一个。
2. 依次加入 To Read、Reading Now、Have Read；同一册同时存在于 0、2、3、4。
3. 依次从 3、4、2、0 移除；每一步都只撤回对应成员。
4. 读取全部书架核对清理，十个书架均恢复为空，My eBooks 未因这些测试增加成员。

[步骤记录](2026-10-16-google-books-writes.json)保存每次状态与目标成员的读回，不包含完整账号资料。没有写评分、评论、位置、注释，没有购买、创建／删除书架或调用 clearVolumes，也不声称恢复技术更新时间。

这些结果支持把当前安排与“读过”分别解释，不能假设三个阅读书架互斥。同在 To Read 与 Reading Now 时，本体单一当前状态无法唯一对应，不自行设优先级。独立的卷完成标记只能作用于已经明确对应的这一册。

Discovery 中有 userInfo.review 的本人 ONE…FIVE／NOT_RATED 读取合同，没有评价写入方法。非空本人评价与非空自定义书架尚未取得实测样本，不能用平台均分或系统书架测试代替。

## RanobeDB 实际读取

已实际读取 SAO 的 Series、Book、原作纸书、数字版及 20 册合订发行，以及多语言书名、出版社／品牌、人员署名、独立单行本、衍生关系、标签分页和图片。

| 样本                    | 已观察事实                                                         | 采用含义                                        |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Series 1234、Book 5151  | SAO 主目录 29 个 Book；Book 5151 有原作及译版 editions             | Series、内容单册和发行版分别解释                |
| Release 10222           | 日文 print，352 页，ISBN 9784048677608                             | 该出版物的页数，不能变成整作总页数              |
| Release 10221           | 同一 Book 的日文 digital，374 页，无 ISBN                          | 同册不同载体的页数确有差异，不能混选或补造 ISBN |
| Release 10225           | 英文合订，收录 20 个 Book                                          | 不将其 ISBN 和总量复制给每一册                  |
| Staff 589、alias 12811  | 主档案 BUNBUN，实际插画署名 abec                                   | alias ID 不形成另一名人物                       |
| Staff 6414              | CLAMP 也位于 Staff；返回结构没有个人／团体判别字段                 | 不按 Staff 路径统一建立 Person                  |
| Publisher 9、19         | KADOKAWA 与电击文库分别有档案，发行参与分别标为 publisher／imprint | 主体与作品职责分开，品牌不并入出版社            |
| Series 6694、Book 19970 | 《我想吃掉你的胰脏》同时具有 Series 与 Book，当前完成且只有一册    | 单个书目数本身不能成为自动粒度判断规则          |
| Series 677 → 6039       | 明确返回 spin-off                                                  | 可以采用直接衍生关系；不会按标题猜其他关系      |
| Book 日期 20100499      | 日未知                                                             | 采用 2010-04 精度，不造完整日期                 |
| /tags?limit=2           | 实际返回 24 项，总数 166、总页数 7                                 | 以实际响应分页，不按请求 limit 推算终点         |

详情实际响应带 {series}、{book}、{release}、{staff}、{publisher} 外层，官网文档中的示例类型未完整体现这一点。/series 名称搜索已使用小页连续读取，不能将第一页当作完整候选。

Series.description 在官网显示为 Note；页面 Description 使用另一个字段 book_description，即所选单册简介。方案区分整作说明与单册剧情，不把第一册简介直接复制为整部小说简介。Book 的 description 与 description_ja 分别保存实际语言内容。

Series 页面将 books 第一项的图片作为代表图。这是官网自己的代表图选择，API 没有独立 Series 图片字段。方案允许沿用并说明来自哪一册；不宣称它是专门绘制的整作封面。

Book 5151 的实际图片地址从官网 HTML 核对为 images.ranobedb.org 下的真实 filename，HEAD 返回 200、image/jpeg、52337 字节。image.nsfw 与 image.spoiler 只描述图片，不是整作的敏感和剧透标记。未进行图片附件采用或运行 UI 验收。

## RanobeDB 个人接口的新事实

[官网 API 说明](https://ranobedb.org/api/docs/v0)仍称当前只有只读端点。但当前[官方仓库](https://github.com/Blastose/ranobedb)版本 c86288de2343c49425204a4a0c3bc75b9160a176 已包含以下实现与 PAT 测试：

- GET /api/v0/user/me。
- Book、Series、Staff、Publisher、Release 的 PUT 与 DELETE。
- /api/v0/user 路径内的 Bearer PAT 认证。

本轮匿名请求 /api/v0/user/me 返回 401，与源码中的认证边界一致；这不能证明认证后的读取或各写入路由已经实际可用。未取得本人 PAT，也没有进行任何远端写入。

当前公开 v0 路由没有列出本人书目／系列列表的 GET，也没有 /user/book/<id> 或 /user/series/<id> 的记录 GET。/user/me 返回账号摘要而非清单；认证 hook 只在 /api/v0/user 下解释 Bearer。公共 Book／Series 详情路由没有传入个人列表查询所需的 userId，也没有返回网站详情页的完整个人表单，不能用公开详情代替个人记录读取。

Book／Series PUT 复用完整表单 schema。Series 需要阅读状态、自定义标签、发行语言／格式、通知偏好等；评分、日期、备注缺席时也可能按默认值替换。公开 API 缺少对应完整读取能力，不能单靠这些端点构造准确投影或核对未知写入结果，更不能用默认值覆盖未知字段来交付“同步”。

补查确认网站本身另有个人数据读取路径，不能将上述缺口表述为网站完全没有个人读取能力：

- 网站的 Book／Series 清单服务按账号身份读取，处理私密账号检查，并提供每页 24 项的分页。匿名公开样本的 Book 三页共返回 70 个不同 ID，Series 四页共返回 73 个不同 ID，均与响应总数一致。未启用 booklist／serieslist 标志，避免套用用户已保存的默认筛选。
- 网站 Book／Series 详情页返回 userListForm／userListSeriesForm。匿名响应已核对字段结构，但它们是未登录表单，不是本人非空记录样本。已登录分支从数据库读取状态、评分、日期、备注、自定义标签及 Series 通知／发行偏好，见 [Book 页面服务](https://github.com/Blastose/ranobedb/blob/c86288de2343c49425204a4a0c3bc75b9160a176/src/routes/book/%5Bid%3Dinteger%5D/%2Bpage.server.ts)和 [Series 页面服务](https://github.com/Blastose/ranobedb/blob/c86288de2343c49425204a4a0c3bc75b9160a176/src/routes/series/%5Bid%3Dinteger%5D/%2Bpage.server.ts)。
- 上述实测使用网站原生的 SvelteKit __data.json 页面数据响应，共 9 次匿名读取；它们不属于公开 v0 API。本人访问依赖网站 auth_session 会话。登录源码要求 Turnstile 校验，会话有效期为 30 天，进入最后 15 天后正常访问可续期；没有尝试登录、读取浏览器 Cookie 或绕过校验。

用户已确认不提供个人导入／同步。终态据此明确只提供 RanobeDB 资料能力，不采用网站登录会话与内部页面协议，也不将个人能力列为分期任务。此处分别记录 API 缺口、网站实际能力和方案取舍，不以实现排期代替来源边界。

## 仍待核验

Google Books 还需覆盖非空本人评价、自定义书架等样本。RanobeDB 还需在实现阶段验收完整多页读取、反向制作履历、原作发行范围、独立单行本处理、部分收录和所有本体采用操作。

网站页面数据仅用于上述匿名只读核验，未加入扩展运行方案；没有导出浏览器会话或改动已有私人记录。后续结果追加到同组材料，不以请求合同、源码存在或方案草案代替实际通过。

本轮两个本机授权接收器已关闭，临时令牌及凭据引用已释放，凭据传递文件已移除；不将本地清理表述为撤销 Google 服务端授权。项目客户端与 Books 专用 key 保留供后续使用。
