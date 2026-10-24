# VNDB 普通字段与正文验证

验证日期：2026-10-11。四次公开 POST 查询的保留样本均返回 HTTP 200、more 为 false，实际请求与响应摘录保存在[普通资料样本](2026-10-11-common-metadata.json)中。摘录保留所需元数据，正文只保存格式、长度与校验值，明确列出省略字段，不复制完整第三方简介。没有使用账号凭据或执行远端写入。

| 查询对象              | 结果 | 核对内容                                                               |
| --------------------- | ---- | ---------------------------------------------------------------------- |
| VN v17                | 1 条 | 多语标题、别名、原作与可用语种、日期、简介、图片与截图、外链、站点统计 |
| Character c15、c42    | 2 条 | 普通字段、生日、性别数组、尺寸、作品定位、特征与剧透标记               |
| Staff s81，ismain = 1 | 1 条 | 主署名、别名、人物性别、简介与外链                                     |
| Producer p8           | 1 条 | 组织类型、名称、别名、简介与外链                                       |

## 与本体已有字段的对应

对应规则已写入[普通资料字段](../../../design/extensions/sources/vndb.md#ordinary-fields)和[角色字段与定位](../../../design/extensions/sources/vndb.md#character-fields)。名称和别名不改变身份；语言只采用 olang 作为原作语种，公开站点统计不进入个人记录。

c42 的 birthday 为月日数组，值为 [12, 28]，可以直接表示为本体的 { month: 12, day: 28 }，不需要增加年份。c15 没有生日值。样本中的角色定位包含 main、primary、appears，与本体 main、cameo 及说明能够对应，不需要新增来源专属分类。

[Kana API 文档](https://api.vndb.org/kana)区分非剧透与剧透的性别值。两个角色样本的 sex 和 gender 都各有两项；本体采用非剧透 gender，不另外以 sex 推断。[源站当前 API 源码](https://code.blicky.net/yorhel/vndb/src/branch/master/lib/VNWeb/API.pm#L937)也将这两个投影分别计算，生日从已有月日值组成。源码用于核对字段解释，不能代替未取得的实际边界样本。

## 日期范围

同日公开读取源站 API 源码与 [update_vncache 的日期计算](https://code.blicky.net/yorhel/vndb/src/branch/master/sql/func.sql#L285)。API 的 released 读取 c_released；当前计算取官方、未隐藏、非试玩且有日期的发行中的最早值，包含 partial，未限定原作语种。

因此 released 可作为来源对作品首次正式公开日期的声明，与本体字段含义相符；它不等于先前为开发和发行署名确定的“首个正式原语种完整版”。[相关规则](../../../design/extensions/sources/vndb.md#first-release)明确保留这种目的上的区别，没有把两个不同范围改成同一日期。

## 明确标记的剧透正文

c42 的 description 含有一个显式 spoiler 片段。[源站格式说明](https://vndb.org/d9)说明 spoiler 用于标记剧情信息，raw 和 code 可以保留格式代码的字面示例。

按 [VNDB 扩展的正文采用规则](../../../design/extensions/sources/vndb.md#descriptions)，扩展解析并剔除完整剧透片段，再将保留内容转换为 Markdown。验收扩展交付的 description 不含这些片段及其图片引用，普通内容和代码中的字面标记仍保留，明确空值与转换失败分别处理。角色、关系和标签自身的结构化剧透标记沿既有合同交付。

[正文投影样本](2026-10-11-description-projection.json)记录实际 c42 正文剔除前后的长度与校验值，以及嵌套片段、raw／code 字面标记、隐藏图片引用、全剧透正文和未闭合标记的独立原型检查；其中可阅读的文本示例是合成内容。实际样本从 812 个字符变为 661 个字符，移除一个显式片段。检查停在 Markdown 转换之前，完整 VNDB 扩展的格式转换与 provider 返回值仍需实现验证。

数据出处及例外范围见[源站许可说明](https://vndb.org/d17)。本节保留字段事实与验证记录，不重发受独立条件约束的完整简介。

## 个人记录与后续范围

按官方文档给出的公共示例，读取 user = u1 的[公开标签定义](2026-10-11-public-list-labels.json)返回 HTTP 200，确认固定标签 1–7 的实际名称。没有读取该用户的作品清单，也没有把示例账号当作当前用户。

公开标签定义不验证本人连接、私有标签、个人状态组合、日期映射或回写。[角色范围验证](character-scope.md)已补充发行限定和实例样本；[标签、图片与账号边界验证](tags-images-account-boundaries.md)进一步核对了标签采用、图片用途及扩展内筛选规则。真实账号读写与图片字节准备仍需实现验收。
