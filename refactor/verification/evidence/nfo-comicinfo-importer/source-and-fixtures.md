# NFO / ComicInfo 格式与合成核验

2026-10-17，第 24 项。用户明确没有实际 NFO 或 ComicInfo 文件，使用合成样本。[完整方案](../../../design/extensions/importers/nfo-comicinfo.md)已确认。本记录验证格式与有界样本，不代表正式扩展、源软件或本体运行验收。

<a id="sources"></a>

## 固定来源

| 项目             | 固定依据                                                                               | 用途                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Kodi 稳定版      | 21.3-Omega，a3a448d26b8d560a65655dab2cd122994dc4e146；GitHub release 发布于 2025-10-31 | VideoInfoTag、NfoFile、VideoInfoScanner、VideoDatabase、ApplicationPlayerCallback 和 SaveFileStateJob |
| Kodi 开发格式    | 8f6c50bd005f5b96426db93f8861cb063b2ebb21，提交于 2026-10-17                            | 对照新增原作语言、NFO 读取与新版多集说明；不作为 Kodi 22 已发布的证据                                 |
| Anansi ComicInfo | 99e1453a163c777b4b5320a68732f6f133ac7918，提交于 2026-06-23                            | 1.0、2.0 XSD，2.1 Draft XSD、字段文档和变更说明                                                       |
| ComicRack CE     | 7fd9fd35a9cf829fffc6aa9cd0b44c7325df0cb7                                               | 仅核对 ImageIndex、页面字段、归档图片排序及比较器；不扩大为 ComicRack 全库导入器                      |

本次源码调查记录 35 次公开请求，32 次 HTTP 200、3 次 HTTP 404；取得 23 个源码／schema／说明文件。Anansi 没有 latest-release API 结果，实际依据是仓库内稳定 schema 与 drafts；另两个 404 是 SaveFileStateJob 的路径候选，实际文件已在 xbmc/utils 下取得。URL、时间、字节数与 SHA-256 保存在 [verification JSON](2026-10-17-verification.json)。

官方说明包括 Kodi 的[电影 NFO](https://kodi.wiki/view/NFO_files/Movies)、[整剧 NFO](https://kodi.wiki/view/NFO_files/TV_shows)、[分集与多集 NFO](https://kodi.wiki/view/NFO_files/Episodes)，以及 Anansi 的[字段文档](https://anansi-project.github.io/docs/comicinfo/documentation)和[2.1 Draft](https://anansi-project.github.io/docs/comicinfo/schemas/v2.1)。字段资料和源码共同使用，不能把文档中提前说明的开发版本叫作稳定版。

<a id="findings"></a>

## 影响设计的核验结果

| 事实                                                                     | 设计结论                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| NFO root 不区分动画与真人；tvshow 通常描述跨季整体                       | 只处理用户明确选择的动画范围；整剧身份不绑到季，不自动制造上层条目                |
| 21 及之前支持单文件多个 episodedetails；新版文档改为每集 -SxxEyy NFO     | 两种输入分别解析与配对，不只按当前一个规则读取历史资料                            |
| ratings／rating 是公众评分，userrating 才是本人值；0 是未评分            | 个人值区分未知、空模板和明确撤回，公众分数不冒充本人评分                          |
| 代码中的 userrating max 归一存在整数除法损失                             | 本项按文件明确量尺正确归一，不复刻这个源程序读取缺陷；正常 Kodi 导出没有 max 属性 |
| 播放达到源已看条件后 IncrementPlayCount；未达到条件也 UpdateLastPlayed   | 独立影片的已看次数可以初始化空历史，lastplayed 不提供任何一次完成日期             |
| TV show 的已看值由当前分集聚合而来，通常只有 0／1                        | 不生成 Work 完成；分集自己的计数只转 Part 布尔标记                                |
| resume 是秒数，runtime 是分钟资料；episodebookmark 不是观看区间          | 只在实际同一时间轴保存续播，不造活动、不推导分集时间范围                          |
| ComicInfo Volume 是出版批次，Number 是书目标签；作者字段可能是个人或团体 | 不把 2018 当第 2018 卷，不从名字建立人物／组织／角色图谱                          |
| ComicInfo 标准没有个人已读进度；CommunityRating 为公众值                 | 不识别任意私有 ReadCount／LastPageRead，也不转换本人评分                          |
| Notes 常保存生成软件信息，Review 没有统一作者说明                        | 用户分别选为文字 Note，不自动冒称私人笔记或本人评论                               |
| ComicInfo 2.1 仍是 Draft，除四个新增字段还收紧 CommunityRating 小数精度  | 固定该草案版本，三份 XSD 分别验证，不把它当稳定 2.0 的完全等价替换                |
| ComicRack ImageIndex 零基，指向排序后实际图片；Page 元素可以另排         | 按 Image 找成员，不能按 XML Page 的数组下标绑书签或封面                           |
| ComicRack 比较器含自然数字规则与区域性文字比较                           | 样本只证明简单 ASCII 页序；其他文化、排序并列与未知生产者须完整适配               |

计数与最近播放的关键代码见[状态保存](https://github.com/xbmc/xbmc/blob/a3a448d26b8d560a65655dab2cd122994dc4e146/xbmc/utils/SaveFileStateJob.cpp)及[播放回调](https://github.com/xbmc/xbmc/blob/a3a448d26b8d560a65655dab2cd122994dc4e146/xbmc/application/ApplicationPlayerCallback.cpp)。来源达到已看条件、人工标记和打开次数并不混为一个概念，本项只解释已核实的 Kodi 字段。

<a id="fixtures"></a>

## 合成文件与 101 项检查

[build-fixture.py](build-fixture.py)生成 20 个输入文件：独立影片 NFO、整剧 NFO、旧多集片段、新每集 NFO、三版 ComicInfo、UTF-16 与字段换序 XML、拒绝用 XML、三份 CBZ、两张封面图和两份两秒视频。具体路径与校验和见 [fixture manifest](fixture-manifest.json)。它只覆盖本证据目录里自己生成的样本，不读取或修改用户资料。

[verify.py](verify.py)使用 lxml 6.1.0／libxml 2.11.9。它从固定 raw GitHub URL 读取三份 XSD，校验预先保存的 SHA-256 后在禁用外部实体与网络解析的 XML 配置中验证；没有安装依赖或在本地保存复制的源项目代码。

1. 三版规范样本分别通过实际 XMLSchema 验证。2.0 不接受 Draft 的 Tags，1.0 不接受新 Manga 枚举，2.1 Draft 不接受两位小数的 CommunityRating。XSD 字段顺序仅用于规范样本，业务读取另测语义不变的换序字段。
2. XML 验证覆盖 UTF-8／UTF-16、转义文字、旧片段序列、未知命名空间、DTD、坏 XML、重复标量、尾随 URL 和混合根。没有发出源 XML 要求的外部实体请求。
3. 字段验证覆盖个人／公众评分、显式零与缺席、max 归一、影片次数初始化、已有历史保护、tvshow 聚合反例、Part 标记、lastplayed 非完成日期、电影／整剧／分集身份范围，以及书目编号、精度日期和 ISBN。
4. 实际 CBZ 含三张不同颜色的一像素 PNG，归档成员为 pages/1.png、pages/2.png、pages/10.png。XML 的第一个 Page 使用 Image=2，正确指向 pages/10.png；FrontCover 指向 Image=0。同时检查多份 ComicInfo、路径越界和无效索引。
5. FFmpeg／ffprobe 6.1.1 生成并读取实际 64×64 视频，时间轴为 2 秒；1.25 秒续播合法，默认 0／0 不清空位置，越界与不一致 total 不被缩放。配对覆盖同 basename、新多集后缀、多个媒体候选和同一文件的不同续播点。
6. 全部 20 个输入文件在验证前后与 manifest 的 SHA-256 一致。

结果共 **101 项通过**，详见 [synthetic-results.json](synthetic-results.json)。这些是格式与语义探针，未运行 Kodi／ComicRack，也未执行 Kisaki 的 profile 新增、prepared 文件采用、附件、Note、Annotation 或播放器打开。

<a id="reproduce"></a>

## 复现与限制

在仓库根，使用已经存在的 Python、lxml 和 PATH 中的 FFmpeg／ffprobe：

```powershell
D:/scoop/apps/python/current/python.exe refactor/verification/evidence/nfo-comicinfo-importer/build-fixture.py
D:/scoop/apps/python/current/python.exe refactor/verification/evidence/nfo-comicinfo-importer/verify.py
```

构建命令只写上述合成文件，媒体命令使用参数数组且只覆盖已核对的样本路径。验证仅对固定公开 XSD 发起 GET，不上传输入；DTD 与 schemaLocation 不形成额外网络读取。研究脚本的网络加载不进入正式扩展，正式制品使用随包交付的解析依赖与固定字段合同。

当前编码探针只覆盖 UTF-8 与带 BOM 的 UTF-16，归档排序只覆盖简单 ASCII 数字路径，0.25 秒时长差只是这组媒体探针的比较界限，不是已经确定的播放器容差。正式编码支持、完整排序、真实文件／图片准备、文化排序、归属冲突、原生操作、位置重开和六平台制品仍须验收。真实格式不能用当前小样本成功替代完整实现。
