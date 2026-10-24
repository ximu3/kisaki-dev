# YACReader 导入器：源码与合成核验

对应第 30 项[已确认完整方案](../../../design/extensions/importers/yacreader.md)。用户明确没有实际书库、备份或资料导出并选择合成样本；这里没有用户漫画、账户内容或实际迁移结果。

## 来源与基线

核验时，[官方最新发行页](https://github.com/YACReader/yacreader/releases/tag/10.4.0)与 GitHub latest release API 均指向 10.4.0，发布时间 2026-10-09。tag 固定提交为 28f92f4d8bdbb7170f6002e00bed7503356eea03，来源 DB_VERSION 为 9.16.0。应用版本、数据库文本版本和 SQLite user_version 不是同一个值。

[source-probe.py](source-probe.py) 从 42 个固定源文件读取证据，提取十张表的列、默认值、主键、外键、唯一键及建表 SQL，以及资料导出的 59 个实际字段；[source-contract.json](source-contract.json) 保存来源 URL、HTTP 状态、时间、字节数、SHA-256 和官方仓库／发行／tag 回执。用于表形状核验的 SQL 来自固定源码，在内存 SQLite 中解释；没有执行来源应用或接收来源数据库中的 SQL。

| 固定来源                                                                                                                                                                                                                                                                                                                                            | 核实内容                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [data_base_management.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/db/data_base_management.cpp)                                                                                                                                                                                       | 十表库；当前版本；完整备份使用 VACUUM；资料导出只有两张表，并按 edited／comicVineID 过滤，comic_info 通过 CREATE TABLE AS SELECT 生成      |
| [library_creator.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/library_creator.cpp)、[yacreader_global.h](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/common/yacreader_global.h)                                                              | 单个前导斜线的库内路径；根文件夹自引用；前 512 KiB 的 SHA-1 与十进制文件大小直接拼接；封面和数据库路径                                     |
| [db_helper.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/db_helper.cpp)                                                                                                                                                                                                                | 多文件共享 comic_info；评分与阅读写入；未读重置；Favorites 编号 1；标签和列表按 comic.id 联接；顶层列表直接成员与子列表顺序                |
| [InfoRating.qml](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/qml/InfoRating.qml)、[comic_db.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/common/comic_db.cpp)                                                                                | 五星界面、0 初值、桌面整数属性；数据库 REAL 与整型 getter 的差异；作者和 tags 的实际换行分隔                                               |
| [xml_info_parser.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/xml_info_parser.cpp)                                                                                                                                                                                                    | notes／review 可来自内嵌资料；日期缺月日会填 1；任意 Web 末段也可能写入 comicVineID，数字值本身不足以证明平台身份                          |
| [reading_list_model.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/db/reading_list_model.cpp)、[reading_list_management_coordinator.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/reading_list_management_coordinator.cpp) | 标签、特殊列表与普通列表分开；顶层与子列表操作；子列表排序与父级上下文                                                                     |
| [comic.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/common/comic.cpp)、[bookmarks.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/common/bookmarks.cpp)                                                                                                      | currentPage−1 与书签原值；-1 空槽；QImageReader 动态格式、无点也匹配的结尾规则；大小写敏感的 __MACOSX 排除；归档双页启发式与独立目录的差别 |
| [qnaturalsorting.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/common/qnaturalsorting.cpp)、[initial_comic_info_extractor.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/initial_comic_info_extractor.cpp)                                  | QCollator 与无自然排序后端时的回退；未持久化区域环境；封面提取不使用相同归档启发式，不能代替阅读页序                                       |
| [epub_page_index.cpp](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/common/epub_page_index.cpp)                                                                                                                                                                                                              | 线性 spine、导航排除、单图包装、32 个有效字符阈值和少量非图片项容忍；重复图片仍可对应不同页面出现项                                        |

这些是来源事实。最低完成、是否采用喜爱、普通 Note、手动合集及位置转换的取舍由接入方案明确规定，不能把来源名称等同于本体含义。

## 实际合成输入

[build-fixture.py](build-fixture.py) 生成数据库与媒体案例；[fixture-manifest.json](fixture-manifest.json) 记录 32 个输入文件的字节数与 SHA-256。

- 一个包含十张当前表的书库、以 VACUUM INTO 生成的完整备份、按来源过滤与字段清单生成的两表资料导出，以及另一个内部 ID 碰撞的独立书库。
- 六条 comic_info 与六条 comic，含两份共享记录的真实 CBZ、相邻的超安全范围整数 ID、未打开默认值、已读却不满足资料导出条件的书、孤立但有文字的资料，以及缺失文件。
- 合法标签颜色名、空标签、Favorites 正向关系、顶层与两个有顺序的子列表、重复目标成员和空列表。
- 实际图片字节、逆序 ZIP 成员、page1011 双页名称、作品封面和不同归属的文件夹封面；另有真实 TAR／CBT 字节。
- 三页合成 PDF，复制此前已渲染核验的几何夹具，含不同旋转、CropBox 与 UserUnit；本次对字节一致性及物理页位再次核对，并复看相同字节的三张渲染图。
- 固定图像 EPUB，spine 包含导航、文字页与重复使用同一图片的独立出现项；另有重排版式和缺图案例。
- 未知 schema、缺表、断开关系、环与孤儿列表、非法个人字段、来源视图和非 SQLite 文件；重复／越界归档成员、大小写与前导零排序冲突、Unicode、未知图片插件、无点结尾及 __MACOSX 大小写边界。
- 两份前 512 KiB 和大小相同、尾部不同的文件，实际证明来源 pseudo hash 无法保证完整字节一致。

上述数据全部为测试构造。样本中的 example.invalid 只表示未核实来源链接，没有向其发起请求。小数评分是 REAL 存储列的边界样本，不冒充本次通过来源桌面界面实际生成的记录。

## 已执行检查

[verify.py](verify.py) 直接读取这些 SQLite、ZIP、TAR、PDF、EPUB 与图像字节；[synthetic-results.json](synthetic-results.json) 记录 116 项通过、0 项失败，全部 32 个输入保持字节不变。

检查覆盖完整备份与部分导出的差别、59 字段 CTAS 结构、真实只读拒写、版本和来源 schema、准确整数、根自引用与异常外键、多副本共享记录、跨库 ID、作者和标签换行、来源文字、评分尺度和默认保留、空历史已读事实与 Part 范围、无活动时长字段、标签与两层列表、路径重建、缺文件与封面归属。

图片定位检查读取实际页图，验证 ZIP 存储顺序不作页序、双页启发式的移动、不拆分合并图、1000 页边界、从零书签与从一续读、默认未打开不采用位置、重复槽位、越界拒绝，以及无点结尾、大小写敏感排除和保守排序范围。PDF 采用物理 pageIndex；EPUB 将源第三张图片映射到原始 spine 第五项，即零基 index=4，重复图片没有被折叠成同一出现项。

探针对自然排序采用可以证明不受区域环境影响的有限输入范围，没有执行 Qt 的 QCollator。图像识别使用明确 PNG／JPEG 案例，未知来源插件没有被当成已排除的非页成员。Python 的类型与精度行为也不等于正式 Node SQLite 绑定已经验证。

## 复核与限制

```powershell
python refactor/verification/evidence/yacreader-importer/source-probe.py
python refactor/verification/evidence/yacreader-importer/build-fixture.py
python refactor/verification/evidence/yacreader-importer/verify.py
```

需要 Python、Pillow 和 pypdf；首次建立夹具前须提供与已记录摘要一致的合成 PDF。当前目录已包含该输入，重跑生成脚本不改写 PDF。[汇总记录](2026-10-17-verification.json) 保存基线、回执与核验范围。

本次没有启动 YACReader、Qt／C++、移动客户端或正式导入器，没有访问实际书库、WAL 写入会话、账号、真实漫画来源或本体数据库。正式支持的 RAR／7z 等后端、未知图像插件、任意区域排序、实际 Kana 坐标恢复、附件保存和原生写入仍须分别验收；没有把这些写成合成已通过项目。

正式用户流程、来源一致快照、大型输入预算、取消、空历史并发条件与六平台独立制品，按[实施验收](../../../design/extensions/importers/yacreader.md#implementation)完成。完整方案已确认；技术证据与正式实施验收继续分别记录。
