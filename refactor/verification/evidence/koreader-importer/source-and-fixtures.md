# KOReader 导入器：源码与合成核验

对应第 28 项[完整方案](../../../design/extensions/importers/koreader.md)，完整方案已确认。用户明确没有实际资料并选择合成样本；本目录不包含真实用户书库。

## 固定来源

基线是 [KOReader v2026.07.1](https://github.com/koreader/koreader/releases/tag/v2026.07.1)，发布于 2026-08-01，固定提交 9192014d8bd82a91dc1012473be0f238dedfdb54。该版本的 koreader-base 提交为 6e4bc81af4e04f78d81677a323a780a71b29702a，绑定 MuPDF 1.27.2；MuPDF 来源固定在 73d3100d46d8a9ad634f6ef035bbe78f0f947886，并单独核对 KOReader 的 CBZ 目录和 WebP 补丁。

[source-contract.json](source-contract.json) 记录 43 个固定源文件的 URL、HTTP 状态、读取时间、字节数和 SHA-256，以及从统计建表语句提取的真实表列。只读取来源源码文本，不运行 KOReader、Lua 或其插件。

| 来源                                                                                                                                                                                                                                                                                                                                                                                                                                 | 核实的事实                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [JSON exporter](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/plugins/exporter.koplugin/target/json.lua)、[批注提取](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/plugins/exporter.koplugin/clip.lua)                                                                                                                                                     | 单书／多书包络、json/1.0.0、可选整文件摘要、导出时间；当前导出丢失完整端点与几何，纯页书签可能未进入导出              |
| [docsettings](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/docsettings.lua)、[dump](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/dump.lua)                                                                                                                                                                                             | 当前 .sdr 布局、路径及集中／摘要存储，Lua 表和转义规则；来源自己执行 Lua 的做法不进入导入器                           |
| [bookstatuswidget](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/ui/widget/bookstatuswidget.lua)、[filemanagerutil](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/apps/filemanager/filemanagerutil.lua)                                                                                                                                  | reading／abandoned／complete；abandoned 在界面表示搁置；1–5 星；modified 也会因评分和书评保存而变化，不能作为完成日期 |
| [统计插件](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/plugins/statistics.koplugin/main.lua)                                                                                                                                                                                                                                                                                                  | schema 20221111、book／page_stat_data／numbers、组合书目索引；暂停后调整起点、短长停页限制、重排视图的整数除法和缓存  |
| [readcollection](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/readcollection.lua)、[util](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/util.lua)                                                                                                                                                                                       | favorites、保存的实际成员、手动 order 与 collate 差异；分段 MD5 的采样偏移，首段起点是 0                              |
| [readerhighlight](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/apps/reader/modules/readerhighlight.lua)、[koptinterface](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/document/koptinterface.lua)、[pdfdocument](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/document/pdfdocument.lua) | 当前 PDF pboxes 的原生页坐标、重排映回、跨页 ext、区域端点除 zoom，以及 x+w−1／y+h−1 的 PDF 写入约定                  |
| [MuPDF 页面变换](https://github.com/ArtifexSoftware/mupdf/blob/73d3100d46d8a9ad634f6ef035bbe78f0f947886/source/pdf/pdf-page.c)、[CBZ](https://github.com/ArtifexSoftware/mupdf/blob/73d3100d46d8a9ad634f6ef035bbe78f0f947886/source/cbz/mucbz.c)、[KOReader 构建与补丁](https://github.com/koreader/koreader-base/blob/6e4bc81af4e04f78d81677a323a780a71b29702a/thirdparty/mupdf/CMakeLists.txt)                                     | CropBox／UserUnit／Rotate、图片后缀、自然数字比较及平台歧义；目录补丁不将源目录变成本体 Part                          |

## 样本与解析方式

[build-fixture.py](build-fixture.py) 生成 33 个合成输入，清单和每项字节摘要见 [fixture-manifest.json](fixture-manifest.json)。包含三种真实媒体、四份当前书目随书数据、custom_metadata、实际封面、收藏／手动／自动规则集合、schema 20221111 数据库、两类 JSON 包络、Markdown／TXT、正常和恶意 Lua 数据，以及四个边界 CBZ。

三页 PDF、CBZ、EPUB 和封面复用此前已检查的 Koodo 合成文件，字节不变。PDF 包含 CropBox、0／90／270 度旋转及 UserUnit=2；CBZ 包含 pages/1.png、2.png、3.PNG、10.png，验证本来源自然序和大写扩展名。另有排序等值、32 位数字溢出、不确定 Unicode 比较和源支持但本体可能不支持的图片成员。

Lua 语法使用 [luaparse 0.3.1](https://github.com/fstirlitz/luaparse) 的固定包。探针核对 npm tarball 的 SHA-512 完整性和解析模块 SHA-256，只读取确切模块，不安装全局依赖；依赖收据见 [dependency-contract.json](dependency-contract.json)。运行的是 AST 解析库，输入 Lua 从未执行。

Lua 字节用 Latin-1 一对一传递到 pseudo-latin1 模式，选择文字时才作严格 UTF-8 解码。受限 AST 遍历使用 Map，区分数字／文字键及原型样式键，拒绝重复键、代码表达式和超预算数据。当前数据解析结果见 [parsed-fixtures.json](parsed-fixtures.json)，全部内容为合成输入的派生结果。

## 已执行检查

| 检查组                         | 结果与覆盖                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Lua 数据探针](verify-lua.mjs) | [32 项通过](lua-results.json)：中文及十进制字节转义、长字符串、nil、键类型、代码样式字符串、未选非法文字、12 类拒绝样本、三类资源预算、6 份实际当前数据和输入保持不变                                                                                                    |
| [结构与采用模型](verify.py)    | [107 项通过](synthetic-results.json)：元数据覆盖、状态与星级、空历史完成及无日期、合集顺序／收藏、授权路径、图片、两种摘要、SQLite 结构和只读、64 位 ID、真实组合键、原始时长与视图取整差异、附加值、JSON 文字、XPointer 降级、实际 PDF 几何／跨页／区域、CBZ 成员及边界 |

合计 139 项通过、0 项失败，33 个输入文件的摘要保持不变。数据库探针只读并启用 query_only 和 trusted_schema=OFF；为了核实来源取整行为，仅在本工具自己生成的固定合成库上执行已知 page_stat 视图，正式导入不执行来自用户库的任意视图。

时长样本证明原始 5 秒按来源视图拆成两页后合计为 4 秒，以及一书原始 15 秒与视图 14 秒的区别。采用原始表是本方案明确选择的口径，并非声称所有来源界面的总数都相同。没有页记录的已知书目在此口径下为 0，缓存不补回；非法记录阻止该书总量采用。

PDF 核验读取实际 PDF 页面结构并执行固定源码导出的数学模型，保留每行与每页，拒绝丢页、退化框和越界；没有运行此基线的 MuPDF 二进制、PDF.js 或 Kana。XPointer 没有转换成 CFI，JSON 没有凭单个起点补造高亮，非零近似页内进度没有伪装成精确续读。

## 复核与限制

```powershell
python refactor/verification/evidence/koreader-importer/source-probe.py
python refactor/verification/evidence/koreader-importer/build-fixture.py
node refactor/verification/evidence/koreader-importer/verify-lua.mjs
python refactor/verification/evidence/koreader-importer/verify.py
```

Python 需要 Pillow 和 pypdf；Node 使用内置模块，Lua 探针通过 HTTPS 取得已锁定解析包。来源探针和解析依赖收据包含精确摘要，后续不得用浮动主分支或未核对的新包覆盖基线。构造媒体副本时遵守 PDF 制品工具的记录要求。

本次没有真实 KOReader 用户输入、Lua 应用运行、原生数据库写入、后台任务、实际阅读跳转或独立扩展制品证据。正式实施仍须按[方案验收范围](../../../design/extensions/importers/koreader.md#implementation)验证，不能以语法和数学探针代替完整导入。摘要、状态和时长都是本次来源解释，不持久保存为另一套来源模型。
