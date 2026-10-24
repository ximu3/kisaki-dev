# Koodo Reader 来源与合成核验

2026-10-17，第 26 项。[完整方案](../../../design/extensions/importers/koodo.md)及累计时长修订已确认。用户明确没有实际备份或导出，使用合成样本；没有运行 Koodo、源插件或正式 Kisaki 导入器，没有使用用户书籍或笔记。

<a id="sources"></a>

## 固定来源

当前固定到 [v2.4.6](https://github.com/koodo-reader/koodo-reader/releases/tag/v2.4.6)，GitHub release 的 published_at 为 2026-10-07T00:29:56Z，prerelease=false，提交 1fd0cc7f151916447d396e0c8a2c036180992cab。上游仓库默认 dev 分支不作为本项可变基线。

发布 API 的实际响应摘要、方案状态、检查数量与不作承诺的范围汇总在 [verification JSON](2026-10-17-verification.json)。

[source-probe.mjs](source-probe.mjs)取得 39 个固定源码文件，仅作为文字和静态 AST 读取，不执行应用或打包库。它提取四张表的列声明、CommonTool.configList 与 20 个位置相关方法的偏移／摘要；URL、检查时间、HTTP 状态、字节数和 SHA-256 保存在 [source-contract.json](source-contract.json)。保留派生合同，不复制完整厂商源码。

| 来源                                                                                                                                                                                                                                                                                                                                                                                                                                             | 已核实事实                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [backup.ts](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/backup.ts)、[backup-util.js](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/main/backup-util.js)                                                                                                                                                                     | 当前全库 ZIP 的 config、book、cover 布局；数据库关闭后打包，另有存储导出和 snapshot；不证明用户实际副本完整             |
| [Book](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/models/Book.ts)、[Note](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/models/Note.ts)、[BookLocation](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/models/BookLocation.ts)                                                              | 私有键、字段类型与位置对象；模型不等于全部落盘类型，颜色另有字符串路径                                                  |
| [sqlUtil.ts](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/sqlUtil.ts)、[databaseService.ts](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/storage/databaseService.ts)、[kookit-extra](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/assets/lib/kookit-extra-browser.min.js) | 四张真实表、date／tag 的 JSON 存储、计时秒数及日期汇总、声明配置名单；没有据此发明持久 schemaVersion                    |
| [configUtil.ts](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/configUtil.ts)、[common.ts](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/common.ts)                                                                                                                                                                            | 双层配置、缺席省略、convertPDFBooks 决定 PDF 重排，但不在当前 dumpConfig 名单中；不能从备份缺席推断原页模式             |
| [export.ts](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/export.ts)                                                                                                                                                                                                                                                                                                                 | JSON／CSV、全量与分书 ZIP、标签逗号连接、书名分组、笔记与高亮差异；PDF／HTML 等展示导出另有路径                         |
| [markAction](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/components/dialogs/markAction/component.tsx)、[bookCardItem](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/components/bookCardItem/component.tsx)                                                                                                                                   | 已读写入字符串 1 并保留旧位置，未读删除位置；Done 判断和百分比显示四舍五入不同                                          |
| [sidebar](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/containers/sidebar/component.tsx)、[coverUtil](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/coverUtil.ts)                                                                                                                                                                  | 书架顺序与封面前缀查找；该前缀匹配可使 key=12 命中 123，试件按明确身份核对                                              |
| [importLocal](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/components/importLocal/component.tsx)、[preload.js](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/preload.js)                                                                                                                                                                          | 完整文件 MD5 与另一路 KOReader 部分摘要分开，不可互换                                                                   |
| [noteUtil](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/reader/noteUtil.ts)、[popupNote](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/components/popups/popupNote/component.tsx)、[kookit](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/assets/lib/kookit.min.js)                    | 摘录与 textarea 普通文字、cfi 包装、Rangy 选区、原 PDF convertToPdfPoint、漫画成员、Fabric 画布；不证明所有历史版本同义 |

[dependency-probe.py](dependency-probe.py)另从 [npm 的 Rangy 1.3.0 记录](https://registry.npmjs.org/rangy/1.3.0)取得精确 tarball，在内存中校验 SHA-512 integrity，并只读 package/lib/rangy-textrange.js。结果见 [dependency-contract.json](dependency-contract.json)。saveCharacterRanges 的 characterRange、backward 与缺省 characterOptions 已核对；没有将其他 alpha 版本或 raw textContent 当作本版本实际可见文字序列。

<a id="findings"></a>

## 影响设计的判断

- Book 键与文件 MD5 不是公开作品 ID。新作品统一经 profile／initial，来源资料之后按选择 prepared 更新；已有对象正常复用。
- source Done 是最低完成事实，不能提供次数、日期或当前安排。源百分比 0.99999 可显示 100.00，但并不是保存值 1；标记已读也不证明位置已到末页。
- 源时长有累计与按日秒数。按用户修订，readingTime 的有效累计值采用为漫画／小说附加时长，日汇总不重复采用、不生成活动，也不另存概况笔记。四类 Work 共用相同附加时长规则。书架是合集，Note.tag 是笔记上下文；没有据此增加作品标签。
- 当前 cfi 字段多为私有位置 JSON，EPUB 文字范围来自渲染态 Rangy。保留文字有充分依据，转换成通用原文锚点没有充分依据，因此本项不承诺文字格式的位置恢复。
- 原 PDF 高亮有明确页码与用户空间几何；PDF 续读／书签缺少持久原页模式证据时需本次明确确认。CBZ 使用具体 chapterHref，索引单独存在时不猜排序。
- 手绘数据与本体区域标注不同，本项明确不采用其可编辑形态，也不执行源对象来截图。

<a id="fixtures"></a>

## 合成输入与检查

[build-fixture.py](build-fixture.py)生成 [fixture-manifest.json](fixture-manifest.json) 中的 23 个文件。四份实际 SQLite 数据库按固定源码提取的列声明创建，数据完全合成。范围包括：

- 7 本合成书、4 条笔记、2 条书签、1 条摘词，双层 JSON 配置及源码同义的 Done／中间进度／缺位置输入。
- 一份带两项 spine、隐藏文字、重复摘录和补充平面字符的 EPUB；只证明格式与歧义反例，不执行源渲染器。
- 实际 CBZ 与 PNG 页面：自然数字顺序、源过滤排除大写扩展名、大小写比较并列；位置采用具体成员。
- 一份实际三页 PDF：CropBox=[20,30,280,210]，Rotate 分别 0、90、270，第三页 UserUnit=2；各页两段可辨认的蓝色区域。
- 可解码封面及 12／123 键前缀冲突，包含全部文件的真实 ZIP。
- 笔记／高亮 JSON、CSV 与含 all 加分书文件的两份 ZIP，另有旧 JSON 库、穿越成员、多根、非法配置和未知手绘标识的反例。

执行 [verify.py](verify.py)得到 [synthetic-results.json](synthetic-results.json)：103 项通过、0 项失败，全部 23 个输入检查后字节未变。实际调用 SQLite、ZIP、CSV、lxml、Pillow 与 pypdf；其余是小型映射模型。

| 检查             | 实际证明与限度                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SQLite           | 真实头、四张表、实际列和值、只读拒绝写入、完整性；不是任意用户库的一致性保证                                                   |
| 配置与记录       | 双层解码、明确空／未知区别、配置白名单、Done、空历史规则、累计与日值分开；未执行本体记录 API                                   |
| JSON／CSV／ZIP   | 换行／引号／逗号／公式前缀保持文字、标签信息损失、全量只读一次、同键冲突和受限路径反例                                         |
| 文件与 EPUB／CBZ | 完整 MD5、实际图片、源键前缀冲突、真实 EPUB spine、隐藏文字和重复摘录、ASCII 自然数顺序及明确成员；不是通用 locale 比较器测试  |
| PDF              | 实际 PDF 页属性、两行独立 quad、裁切与 0／90／270 度、规范化几何、越界拒绝、未知模式不造位置；不是源 PDF.js 或 Kana 的执行证明 |

PDF 以 Poppler 的 pdftoppm -cropbox -png -r 96 渲染。三页 [第一页](preview/page-1.png)、[第二页](preview/page-2.png)、[第三页](preview/page-3.png)均已由 Codex 查看，文字和两段蓝色区域可辨，旋转符合文件属性。[verify-render.py](verify-render.py)再逐个查找蓝色连通区域，与转换后的六个 quad 对照，9 项通过，误差限为 2 个栅格像素，见 [render-results.json](render-results.json)。

渲染输出报告 Symbol／ArialUnicode 显示字体告警；样本使用 Helvetica 和矢量矩形，逐页查看未见缺字。栅格对照只证明规范化页面几何，不宣称 Poppler 对物理 UserUnit 的缩放已验证。UserUnit 字段与计算另由 pypdf 核对；正式阅读内核仍需独立验收。

生成与验证使用本机已提供的 Python、ReportLab、pypdf、Pillow、lxml、SQLite、Poppler，以及仓库现有 Acorn 8.16.0；没有安装依赖。已记录版本与字节摘要。源码、合成模型和实际应用验收是三种证据，不互相替代。

按用户提出的累计时长修订，新增 [verify-duration.py](verify-duration.py) 与 [duration-results.json](duration-results.json)，33 项通过。它读取既有 Koodo readingTime 与 Mihon 合成 history 数据，检查秒／毫秒换算、安全整数、重复键与冲突、同一 Work 先归集、显式零与未知、采用来源总量时设置附加绝对值、已有活动扣除、重复采用、后续活动、较小总量和相关基线。累计与日汇总不叠加，时间不再改存 Koodo 概况 Note。

这 33 项属于采用模型检查，不是新的真实应用执行证据，也没有重新生成或改写原 23 个输入。连同原 103 项字节／映射与 9 项 PDF 栅格对照，当前共 145 项通过；四类本体记录、UI、并发事务与统计仍按实施验收验证。

<a id="limits"></a>

## 正式验收范围

本次没有真实用户备份、官方导出实例或源程序操作证据。真实字段缺席语义、更多记录／导出组合、源 SQLite 一致性、所有资源预算、完整路径与链接、归档异常、各平台文件系统、完整 PDF 几何与实际跳转均待实施验收。

不支持的旧全库家族、EPUB 等渲染位置及 Fabric 手绘已在方案明确排除，不以“实施时适配”暗示承诺支持。范围若扩大，需要新的真实格式和转换证据及独立设计确认。

profile／initial／prepared、Part 范围、真实作品与文件归属、附件接收、已有值保护、附加时长、空历史条件、文字保真、Note／Annotation／合集写入、取消、结果未知以及六个桌面目标独立制品，均不由上述 145 项检查代替。
