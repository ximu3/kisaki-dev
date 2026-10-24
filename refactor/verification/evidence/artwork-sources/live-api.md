# 图片来源只读接口核验

核验日期：2026-10-16。使用用户提供的两份凭据，执行 31 次只读 API 请求、13 次图片 HEAD 和 5 次最多 64 KiB 的文件前缀读取。没有远端写入、用户收藏查询或扩展配置写入。凭据仅由测试进程内存持有，API 凭据没有发送给图片 CDN；[结构化记录](2026-10-16-public-and-live.json)只保留脱敏结果和必要的公开资料摘要。

本报告验证来源接口和资源特征。正式能力分别见 [SteamGridDB](../../../design/extensions/sources/steamgriddb.md)与 [Fanart.tv](../../../design/extensions/sources/fanart.md)。

## SteamGridDB

取得官方 OpenAPI 2.10.0，真实接口使用 Bearer key 成功。来源的 GET 查询、图片上传与删除共用 API 文档，但本轮和拟定接入均只使用读取。

| 样本或操作                 | 实际结果                                                                 |
| -------------------------- | ------------------------------------------------------------------------ |
| Game 5505                  | 返回 CLANNAD；types=['steam']，它是平台标记                              |
| Steam app 324160           | 对应到 SGDB Game 5505                                                    |
| 名称 CLANNAD               | 返回两个不同游戏，不应直接按首项替用户完成对应                           |
| 名称 a、Fate               | 各返回 10 项；Fate 加 page=1 或 limit=50 后编号序列不变                  |
| 无匹配名称                 | 200，data=[]                                                             |
| 不存在游戏编号             | 404，success=false                                                       |
| CLANNAD grids              | 27 个文件；包含竖幅、方形、横幅，语言有 ja、en                           |
| grids 分页                 | limit=3 时第 0、1 页分别返回 3 项，第 9 页为空；一次 limit=50 取得 27 项 |
| 静态且不含三个标记的 grids | 25 项，不能与包含全部类型／标记的 27 项混为同一查询范围                  |
| heroes、logos              | 分别取得 1、3 个文件                                                     |
| icons                      | 实际 5 个文件：3 PNG、2 ICO；报告的 total 为 16                          |
| icons 分页                 | limit=3 的第 0、1、2 页分别返回 3、2、0 项；PNG 筛选返回 3 项            |

图标的 total 不等于独立文件数；本样本的 16 与 3 PNG 加两个 ICO 的 9、4 个尺寸层之和相同，但没有检查来源计数实现，不能把这项推测当作通用计数合同。

两份 ICO 的 API 宽高都是 0，真实目录中有 16 至 256 像素的正尺寸层。文件前缀证明它们是 ICO 容器并包含 DIB 等数据，未执行完整解码或转换。接口提示尺寸不代替实际图片校验，0 不应进入本体的正尺寸字段。

一个动态样本的原图是 600×900 WebP，RIFF/VP8X 文件头确认动画标记；其 thumb 地址实际返回 video/webm。静态 PNG 样本的头部确认 600×900，缩略图返回 JPEG。因此原图 MIME、预览 MIME、尺寸与动画分别处理。

实际响应还包含 language、mime、宽高、标记和真实作者字段；部分字段未出现在所读 OpenAPI 的对象定义中。搜索的真实 data 元素直接是游戏对象，文档示例却嵌套了 success/data 信封。实现需要以本次核实结构建模，不机械照抄示例或兼容猜测形状。

## Fanart.tv

使用 v3.2，仅发送 client-key 即成功读取，没有发送项目 api-key。这证明个人 key 独立访问在本次环境可用；没有测试项目 key 单独、两种 key 组合或实际的新图延迟边界。

| 样本或操作                                  | 实际结果                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Movie 372058、IMDb tt5311514                | 都返回 Your Name. 及相同 TMDB／IMDb 编号，首次响应有 57 张图片                      |
| TVDB 424536                                 | 返回 Frieren: Beyond Journey's End；有背景、4K 背景、标题标志、海报、角色美术等类别 |
| 芙莉莲 seasonposter                         | 两项均为 season=all，不能当作某个具体季度的海报                                     |
| TVDB 267440                                 | 返回 Attack on Titan；季海报包括 1、2、3、4、all 和缺失季号                         |
| Artist 9388cee2-7d57-4598-905f-106019b267d3 | 返回 Aimer，包含 1 张 artistthumb；albums 是数组                                    |
| 另一 Artist 样本                            | 返回 Evanescence；Artist 响应没有 Person／Group 类型字段                            |
| Label e832b688-546b-45e3-83e5-9f8db5dcde1d  | 返回 Profile Records 及 musiclabel 图片                                             |
| 不存在 Movie 编号                           | 404，带 error 字段，不是成功的空图片数组                                            |

Aimer 的本次 image_count=13，其中只有 3 项是根级图片，其余来自 10 个专辑；不能把 image_count 直接显示为人物主图候选总数。Album 或 Artist 的存在也不能创建本体没有接入的音乐作品或推断人物组织类型。

该人物测试编号由 [MusicBrainz 的明确 Person 页面](https://musicbrainz.org/artist/9388cee2-7d57-4598-905f-106019b267d3)核对，仅用于选择真实样本，不是给 Fanart 扩展增加 MusicBrainz 运行时查询或新的资料来源。

API 返回字符串形式的尺寸、likes、语言与季号，图片类别也有源码类型列表之外的 tvposter、tvsquare 等字段。类型列表不能当作永远封闭的完整图片目录；未知类别需要先解释用途，不能自动成为本体字段。

本轮图片记录没有作者或逐图许可字段。API 文档的许可标记、官方客户端 MIT 许可与素材权利分别处理，不给图片虚构统一许可或将 Artist 当作上传者。

## 图片地址与实际字节

13 次 HEAD 均返回 200，覆盖四种 SGDB 图片、动态原图及其视频缩略、Fanart 影片海报与标题标志、艺人图片、厂牌标志和两种预览。范例 Fanart 海报原图为 641,250 字节，preview 为 15,569 字节，bigpreview 为 47,887 字节；这些是本次字节长度，不是所有图片的固定大小。

原图与预览按各自实际媒体类型处理，不能把 thumbnail 的视频响应当作 PNG，也不能把较小预览保存为用户已经选择的原图。文件前缀检查只验证相应格式特征，未证明整个文件可解码，更没有完成本体的预算、裁剪、转换和附件采用验收。

## 本轮结论与剩余事项

已观察到 SGDB 名称建议截断、图标文件与计数差异及视频预览；Fanart 的影片、整剧与季素材具有不同范围，Artist 名称不能单独证明人物或组织身份。

原 API 与资源请求全部只读。尚未验证项目 key 组合、精确时效、429、来源撤销与完整扩展运行；video/webm 是实际响应格式，图片接入只采用设计支持的原图或静态预览。

来源：[SteamGridDB OpenAPI](https://www.steamgriddb.com/static/openapi.yml)、[Fanart API](https://api.fanart.tv/)、[Fanart 官方客户端](https://github.com/fanart-tv/fanart.tv-api)、[key 申请说明](https://fanart.tv/get-an-api-key/)。
