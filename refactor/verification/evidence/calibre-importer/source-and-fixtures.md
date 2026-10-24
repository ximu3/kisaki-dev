# calibre 源码与合成格式核验

核验日期：2026-10-17。当前最新正式发布为 [v9.16.0](https://github.com/kovidgoyal/calibre/releases/tag/v9.16.0)，发布于 2026-10-09；标签经 GitHub tag 对象解析到提交 61c4027d2bfe737e0177e09952ee4942042a5892。本次固定读取该提交，不把 master 当来源合同。用户表示没有现成书库，因此采用合成样本，没有安装或运行 calibre，也没有读取真实用户库。

[完整方案](../../../design/extensions/importers/calibre.md)已确认。[结构化记录](2026-10-17-verification.json)保存 40 次公开 HTTP 读取、36 个固定源文件及校验值；[合成检查结果](synthetic-results.json)记录 63 项检查。来源事实、方案选择、探针通过与正式实现验收分别成立。

## SQLite 与 OPF

[主库 schema](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/resources/metadata_sqlite.sql)的 user_version 为 28，books 与 data 分别表示书目和格式文件，rating、tags、series 等通过关联表连接。[backend](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/backend.py)按 custom_columns 的 normalized 决定直接 book/value 表或值表／关联表，实际表名为 custom_column_N 与 books_custom_column_N_link。动态表名不能来自任意标签字符串。

[常量定义](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/constants.py)规定 cover.jpg、metadata.opf 和 .calnotes/notes.db。[资料笔记 schema](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/resources/notes_sqlite.sql)当前为 1，notes 以 colname／item 关联分类值，另有资源表和引用表；FTS 使用 calibre tokenizer。正式只读接入须验证含这些虚拟表时的读取，不得修改来源 schema。

[随书备份](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/cache.py)在 _metadata_as_object_for_dump 中加入 all_annotations；[OPF 序列化](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/ebooks/metadata/opf2.py)将每条包装写入 calibre:annotation，并以 calibre:user_metadata:#列名写自定义元数据。普通字段包括 calibre rating、series/index、dc:description、identifier 和日期。calibre／uuid scheme 是内部标识，不是 ISBN。

[Save to disk](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/library/save_to_disk.py)按一个 base_path 写 .opf 与各格式，封面使用对应 basename.jpg；[CLI export](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/cli/cmd_export.py)取得普通 get_metadata，不包含备份专用的 all_annotations。官方 [calibredb 说明](https://manual.calibre-ebook.com/generated/en/calibredb.html#export)列出的格式、封面、OPF 与额外文件，并不等于完整数据库、资料笔记和阅读位置。

## 评分、空值与自定义列

[写入适配](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/write.py)将 rating 转为整数并处理 0／None；完整书库没有该书评分关联同样表示未评分。OPF 可选评分项根本缺席则没有提供该值。合成探针分开验证这两种情况，不能用统一的“空值跳过”隐藏清除含义。

[资料下载合并](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/ebooks/metadata/sources/identify.py)也会给结果设置 rating，因此普通列不能保证是用户自己的评分。方案选择在用户明确指定本人评分列后才迁入，是采用政策，不是来源拥有独立 My Rating 字段。

[JSON 元数据编码](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/ebooks/metadata/book/json_codec.py)当前仍将 is_multiple 写成字符，并同时提供 is_multiple2；多值内容本身保留数组。[config_base](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/utils/config_base.py)将日期包装为 **class**=datetime.datetime 与 UTC **value**。这些键仅按数据读取。[未定义日期](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/utils/iso8601.py)为 0101-01-01，不能生成一次公元 101 年的完成记录。

[自定义列控件](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/gui2/custom_column_widgets.py)区分 html、short-text、long-text 和 markdown。合成多值列特意设置 is_names，使用 & 作为 UI 分隔符，因而保留含逗号的合法值；读取数据库关联值和 OPF 数组不再次切分。计算模板不执行，源标签名也不自动解释为状态。

## 分类与资料笔记

[user_categories 编辑器](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/gui2/dialogs/tag_categories.py)保存值、所属字段及一个工作槽位，并非 book ID 列表。方案按实际字段关联取得静态成员，不恢复虚拟书库的查询行为。

[笔记连接实现](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/notes/connect.py)将资源 hash 拆成算法和摘要，存为 resources／摘要前两位／算法-摘要。[笔记导出](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/notes/exim.py)识别 calres://算法/摘要，并能把资源展开为 data URL。合成 notes.db 包含作者和标签两种笔记及一个 PNG 资源；只验证归属、引用与字节，不声称已通过本体图片准备或完整 HTML 转换。

## 批注与位置

[批注写入](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/backend.py)按 book／format／user_type／user 保存；last_read_positions 另有 user 与 device。批注删除使用 removed，最后位置与已读事实没有同义关系。合成输入有本机和另一位使用者，读取只选本机，删除墓碑不复活。

[高亮创建](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/pyj/read_book/annotations.pyj)保存 spine_name、spine_index、两端 CFI、摘录和批注。[CFI 编码](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/pyj/read_book/cfi.pyj)从浏览器 Document 起算，处理高亮包裹节点及 UTF-16 offset；[阅读视图](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/pyj/read_book/view.pyj)把书签／最后位置的首段当作渲染 spine 索引。这与 [EPUB CFI](https://w3c.github.io/epub-specs/epub33/epubcfi/) 的 package／内容地址不相同。

[EPUB 输入处理](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/ebooks/conversion/plugins/epub_input.py)可能移除重复或不适用的 spine 项；[渲染准备](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/srv/render_book.py)会替换封面 HTML、整理 body，并序列化正文。[源解析](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/ebooks/oeb/polish/parsing.py)优先严格 XHTML，失败时进入 HTML 修复。其他格式通过 [extract_book](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/ebooks/oeb/iterator/book.py)取得转换后的内容，不能将其 CFI 当原始 PDF 页码或 MOBI 地址。

合成 EPUB 包含一个实际 XHTML 章节。探针解析 container、package、spine 和节点，验证来源 /2/4/2[p1]/1:0–5 指向“星光与庭院”，重新编码为 epubcfi(/6/2[c1]!/4/2[p1]/1:0) 与对应终点，再核对同一文本边界。这个样本证明当前简单源树的转换关系；它没有验证完整 calibre 渲染、所有 HTML 修复、复杂范围或 Kana 的真实跳转。越界、切开代理对、缺失章节和视口坐标分别失败，不近似恢复。

## 合成材料与复现

[fixture-data.json](fixture-data.json)中的所有书目、UUID、作者、私人文字、分类和位置均为构造数据。[生成器](build-fixture.mjs)创建 5 个书目、8 个自定义列、6 条批注、3 条最后位置、2 条分类笔记、一份 EPUB、备份 OPF 和同 basename 的导出文件。仅一份来源格式实际存在，另外两个格式引用故意缺失。空白 JPEG 来自固定源码中的 1×1 测试图像，PNG 是合成测试资源，不使用真实封面。

数据库使用来源所需普通表的结构子集，没有构造 FTS、触发器和全部无关表。这些文件不是 calibre 程序实际导出的完整书库；schema 版本与字段形状用于限定探针，不能据此声称所有 schema 28 数据库已验证。

在仓库根目录依次执行：

    node refactor/verification/evidence/calibre-importer/build-fixture.mjs node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
    node refactor/verification/evidence/calibre-importer/verify.mjs node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs node_modules/.pnpm/@xmldom+xmldom@0.8.11/node_modules/@xmldom/xmldom/lib/index.js

生成器只写自身 fixture 目录内的合成产物，重建会覆盖同名合成文件。核验使用 Node v24.11.1 的内置 SQLite，数据库以只读连接打开，禁止启用扩展；故意尝试的数据库更新被拒绝。63 项检查全部通过，10 个输入文件在读取前后的 SHA-256 完全一致。代码只是一组方案探针，不是正式扩展实现或业务测试替身。

仍待正式验收：真实源库和 WAL、完整 FTS schema、一般化的 EPUB 位置适配、其他实际数据变体、资源解码与安全正文、公开本体操作、initial 与已有对象基线、文件登记、真实阅读跳转、取消、页面及独立制品。上述限制已经进入接入方案与验收记录，不以“读通合成库”宣称完整迁移成功。
