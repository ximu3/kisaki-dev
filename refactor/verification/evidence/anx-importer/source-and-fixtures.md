# Anx Reader 来源与合成核验

2026-10-17，第 27 项。[完整方案](../../../design/extensions/importers/anx.md)及 98% 来源已读判定采用已确认。用户明确没有实际备份、数据库或笔记导出，本次只使用合成资料；没有运行 Anx、Flutter 应用、源同步或正式 Kisaki 导入器。

<a id="sources"></a>

## 固定源码与格式

固定到 [v1.14.0](https://github.com/Anxcye/anx-reader/releases/tag/v1.14.0)，发布于 2026-03-19T07:40:40Z，prerelease=false，提交 356b7183e8463e7c60d84a72502d0055e55a19fd。[source-probe.py](source-probe.py)只读 48 个固定源码文件，派生数据库列与升级增列后的 schema 7 结构，不运行源升级或应用代码。各文件的 URL、时间、HTTP 状态、字节数和 SHA-256 保存在 [source-contract.json](source-contract.json)。

| 来源                                                                                                                                                                                                                                                                                                                                                                                               | 核实内容                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [database.dart](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/dao/database.dart)                                                                                                                                                                                                                                                                          | currentDbVersion=7，六张普通表，历史增列，快照与 WAL 处理；试件只读输入，不执行迁移或源头修补 |
| [Book](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/models/book.dart)、[BookNote](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/models/book_note.dart)、[BookNoteDao](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/dao/book_note.dart)                                | 私有键、书目、评分、位置、笔记字段与三种已声明标注；不等于存在公开作品 ID 或完成记录          |
| [评分界面](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/page/book_detail.dart)、[书目筛选](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/providers/book_list.dart)                                                                                                                                              | 五星、半星与零值；finished 只是 readingPercentage>=0.98 的筛选                                |
| [计时写入](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/dao/reading_time.dart)、[实际计时调用](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/page/reading_page.dart)、[读取模型](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/models/reading_time.dart)               | Stopwatch.inSeconds，按书和日期累加，SUM 汇总；startedAt getter 不证明有真实活动区间          |
| [标签 DAO](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/dao/tag.dart)、[分组](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/providers/tb_groups.dart)                                                                                                                                                           | tb_styles 的 1／2 标记、REAL 关系引用，分组 parent_id 与根 0；没有独立人工成员顺序            |
| [笔记导出](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/service/notes/export_notes.dart)、[UTF-8 转换](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/utils/convert_string_to_uint8list.dart)                                                                                                                    | GBK 九列 CSV 没有 CFI／ID；Markdown／TXT 为 UTF-8，展示性分组会损失结构信息                   |
| [书签](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/providers/bookmark.dart)、[文字显示](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/widgets/book_notes/book_note_tile.dart)                                                                                                                                  | 书签也在 tb_notes，color 是百分比；摘录和 readerNote 以普通 Text 显示                         |
| [文件导入](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/service/book.dart)、[MD5](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/service/md5_service.dart)、[数据根](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/utils/get_path/get_base_path.dart)                   | file／cover 布局，完整文件摘要；TXT 先取摘要再转换，后续又可重算，不能固定视为现存 EPUB 摘要  |
| [同步入口](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/providers/sync.dart)                                                                                                                                                                                                                                                                             | WebDAV 路径 anx/database7.db；本项只接收已下载副本，不调用账号或源同步                        |
| [view.js](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/assets/foliate-js/src/view.js)、[EPUB](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/assets/foliate-js/src/epub.js)、[CFI](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/assets/foliate-js/src/epubcfi.js)                  | EPUB 包地址、正文范围、文字段与 UTF-16；其他格式可用 fake 索引地址，不能混用                  |
| [固定布局](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/assets/foliate-js/src/fixed-layout.js)、[PDF](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/assets/foliate-js/src/pdf.js)、[漫画页列表](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/assets/foliate-js/src/comic-book.js) | range=null 的整页位置、PDF 物理页，CBZ 扩展名大小写与普通字符串排序；不是 Koodo 的自然页序    |

上述是当前固定家族的解释依据。代码含旧库升级与恢复分支，不代表本项承诺支持所有旧库；格式探针也没有验证源 GUI 的每一种导入入口。源码与发布信息的汇总见 [verification JSON](2026-10-17-verification.json)。

<a id="decisions"></a>

## 对方案的影响

- 新作品统一经 profile／initial，所选来源资料随后 prepared 更新；内部 ID 与 MD5 不创建公开身份。
- 评分是本人五分尺度。按用户确认，将 98% 来源已读判定用于最低完成事实：整部 Work 仅初始化空历史，Part 只设标记，日期未知；库成员和分组不推断喜爱或当前安排。
- 按日存储的秒数可以先汇总，再作为无日期附加时长采用；不能因为 getter 叫 startedAt 就生成 Activity，也不另建概况笔记。
- 标签必须读取 tb_styles 的已声明标记，普通字体行排除；关系浮点数不能随意截断。层级组转为带完整可读路径的平面合集，只有直接书籍成员。
- CSV 不带位置与身份，重复正文行不能去重。Markdown／TXT 只按整份文字保存，不能从章节标题反推源记录。
- EPUB 原文地址与固定页索引分别适配；生成 DOM 的 PDF 文字高亮没有可直接迁入的原页几何。

<a id="fixtures"></a>

## 合成文件与 89 项检查

[build-fixture.py](build-fixture.py)创建 [清单](fixture-manifest.json) 中的 14 个文件：

- schema 7 的实际 SQLite 数据库，六张表、8 本书、6 条笔记／书签、5 条计时行、层级／异常分组及标签标记；含超过 JavaScript 安全整数的源书目键。
- 相同字节的 database7.db 模拟已下载快照，以及错误版本和无关 schema 反例。
- 两份实际 EPUB，分别为可重排与明确固定版式，含真实 package／spine、补充平面字符、逗号 ID、相邻文字／CDATA 和重复摘录。
- 一份“原 TXT 摘要／现存 EPUB”的合成反例。它说明摘要不能强制视为现存文件摘要，不声称运行了源转换器。
- 一份实际 CBZ、三页 PDF 与 PNG 封面，原样复用此前完全合成的 [Koodo 输入](../koodo-importer/fixture-manifest.json)字节。PDF 早前已逐页查看；本项只核对文件一致和物理页数，没有重新修改或渲染 PDF。
- 官方表头的 GBK CSV，包含中文、逗号、引号、换行、公式前缀、书签百分比和相同正文的不同记录；另有 UTF-8 Markdown／TXT。

数据库按当前列形状创建，计时主键、各自源键、分组默认与自引用外键保留；样本是人工构造的普通源表，不是 Flutter 应用实际导出的完整库。无关设置表为空，没有真实账户、AI 配置或私人书籍。

[verify.py](verify.py)实际只读 SQLite、CSV、ZIP、图片和 PDF，并检查受限映射模型。[synthetic-results.json](synthetic-results.json)为 89 项通过、0 项失败，全部 14 个输入字节不变。覆盖：

| 范围       | 验证内容                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| 数据库     | SQLite 头、user_version、六表形状、完整性、只读拒写、错误家族与源键精度                                        |
| 个人值     | 半星、未评分与异常值，98% 已读的最低完成采用、空历史与 Part 边界，按源行汇总秒数、同日多行、零与未知、附加总量 |
| 整理       | 根与层级、同名末级、直接成员、环与失联、样式标记容差、重复／非法标签关系                                       |
| 文字       | GBK 九列、引号与换行、普通文字、无 CFI／ID、重复 CSV 行、书签百分比与未知种类文字                              |
| 文件与页位 | 受限根、缺文件、TXT 摘要差异、实际图片、PDF 物理页、裸 CFI 边界与拒绝文本层地址、CBZ 的 1／10／2 页序          |

<a id="cfi"></a>

## 独立 CFI 数据模块的 19 项检查

[verify-cfi.mjs](verify-cfi.mjs)重新取得已完整检查过的固定 epubcfi.js，先核对 source-contract 中的 SHA-256，再仅将这个没有依赖的地址数据模块放入 Node VM 模块上下文执行。静态与动态 import 均不开放。没有运行 reader、WebView、源插件或书内脚本，也没有将 VM 描述为可用于任意恶意代码的生产隔离边界。

实际 ZIP 由 fflate 0.8.3 读取，XML 树由 @xmldom/xmldom 0.8.11 解析。xmldom 不提供浏览器 Range，本探针使用明确的有界端点模型，仅调用源模块的编码、解析、端点还原及比较方法，不冒称真实选区渲染。

合成 EPUB 的已知范围为：

    epubcfi(/6/2[spine-one]!/4/2[p1],/1:0,/1:4)

它在实际第一篇正文中对应“星光🌙”。检查 package itemref、正文节点、UTF-16 两端、范围拆为完整锚点、代理对拒绝、转义逗号 ID、相邻文字与 CDATA、重复原文、固定 EPUB 页与合成页面索引。[cfi-results.json](cfi-results.json)共 19 项通过。输出原文起止的标准锚点，不把可见百分比变成地址。

这不证明任意被翻译或注入包装的 DOM 都能恢复，也没有验证真实浏览器 Range 或 Kana 跳转。正式实现必须有自己的严格输入校验，不能将源模块宽松 parser 直接当成不可信输入边界。

<a id="reproduce"></a>

## 复现与限度

在仓库根使用已有 Python 与 Node 运行 source-probe.py、build-fixture.py、verify.py；CFI 探针使用：

    node --experimental-vm-modules refactor/verification/evidence/anx-importer/verify-cfi.mjs

Python 使用已提供的 SQLite、Pillow 和 pypdf，Node 使用仓库现有的 fflate 与 xmldom；没有为本次安装依赖。源码探针保存来源收据及派生合同，不在仓库复制整份应用源码。正式扩展必须独立交付依赖，不沿用探针的联网加载或实验性 VM 运行方式。

当前共 108 项检查属于格式、数据模块与采用模型验证。真实 schema 7 副本、完整编码与资源边界、源库一致性、完整 CFI 与源正文变化、平台路径、实际原生新增／更新、附加时长和整理、附件、标注与笔记、取消及六平台制品，仍按方案独立验收。
