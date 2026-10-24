# MangaDex 字段与映射核验

验证日期：2026-10-15。继续使用前轮固定的官方文档版本与匿名资料样本，补读封面、分页、时间和列表说明；没有执行账号登录、私人写入或图片下载。[结构化记录](2026-10-15-metadata-mapping.json)保存必要结果。

## 字段与语言

[官方枚举说明](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/3-enumerations.md)明确区分 zh、zh-hk、pt-br、es-la，以及 ja-ro、ko-ro、zh-ro。罗马字转写不是对应的英文译名。

《四叶妹妹》样本的主 title 是 ja-ro 的 Yotsuba to!，originalLanguage=ja，altTitles 中实际存在 ja 的「よつばと！」。因此原文标题不能直接复制主 title；多语名称、原作语言、简介各自按自己的字段解释。该样本简介有 en、ru、uk、pt-br 四种语言，不能因为标题含中文名就宣称简介也有中文。

实际标签样本提供英文名称，description 为空对象，group 分别为 format 或 genre。TagAttributes 没有敏感或剧透字段；空描述不是读取失败，分类组也不等于本体额外层级。

## 封面与时间

[封面说明](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/03-manga/covers.md)将 manga 的唯一 cover_art 定义为站点主封面，fileName 与 cover UUID 不同。原图与 256／512 像素缩略图使用相同完整文件名；缩略图后缀接在原扩展名之后，不产生新的封面身份。

本次完整读取该漫画的 16 条封面元数据，卷号实际覆盖 1–16，locale 均为 ja；当前主封面对应卷 16。此样本支持“采用站点主封面”与“按卷匹配封面”的区别，不证明每部漫画都提供完整卷封面。

[时间说明](https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/60a3bb3c9f25675435a479c925d857015201739e/01-concepts/timestamps.md)明确 publishAt 是站内可直接阅读时间，readableAt 是内容在站内或外链可读的时间。永久外链可以使用很远的未来 publishAt，不能据此推断原作未发表，也不能将两者采用为原作日期。

## 关系与身份

官方相关关系说明将 adapted_from 与 spin_off 解释为衍生作品和其原作，based_on 与 doujinshi 解释为同人衍生和其原作；不能只按 adapted_from 字面推断本体关系。alternate_story 明确表示故事的另一种展开，alternate_version 则没有保证具体的故事差异。彩色／黑白、连载前／正式连载、同系列和同世界观均有单独称谓，具体本体投影属于设计决定。

当前漫画样本直接给出 al=30104、mal=104、kt=272、mu=auem2hr 和实际官方原文链接。官方旧说明中的 mu 示例仍使用数值旧地址；新式系列代码与旧数值不能无条件当作同一种资源编号。目标来源身份的规范写法是本项目合同，不是 MangaDex 自动提供的完整本体身份。

chapterNumbersResetOnNewVolume 是公开模型的明确布尔字段，卷话聚合提供 id 与 others。前轮样本已核对同一卷话的不同 UUID、译文语言与页数。本轮另查询 Doraemon 的前五个结果，均为 false，因此没有新增 true 分支的真实样本；该分支的设计依据为字段合同，实施仍需相应夹具与实际目录核对。

## 验证范围

普通 Markdown、封面用途、年份精度、编号范围及其他字段采用见[专门设计](../../../design/extensions/sources/mangadex.md)。逐项设计讨论已经完成；本次没有遍历所有漫画、验证全部关系类型、核对全部话内容或执行私人接口。采用分组不等于证明社区数据始终正确；设计规则、公开验证与完整实现验收分别记录。
