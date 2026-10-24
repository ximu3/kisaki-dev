# YMGal 字段与读取路径核验

验证日期：2026-10-15。使用公开应用访问，顺序读取四类档案、机构游戏列表和缺省机构；没有用户授权、私人读写或资料集功能实现。[结构化记录](2026-10-15-metadata-mapping.json)只保存必要的公开字段与结果。

## 依据与实际请求

- [开放 API](https://www.ymgal.games/developer)及固定版本的[档案模型](https://github.com/ymgal/docs/blob/1284ac90454b1e68c15a0fc3e94f6003a927f49b/developers/archive/business-model.md)。
- GET /open/archive：gid=31147、cid=19366、pid=11333、orgId=10041，均成功。
- GET /open/archive/game?orgId=10041，成功返回 24 项；当前响应摘要没有 developerId，必须补读游戏详情确认实际开发方。
- GET /open/archive?orgId=666，成功返回缺省机构，介绍明确它用于未登记开发商的游戏；mainImg 为空字符串。

## 已确认的模型差异

游戏详情包含 game、cidMapping、pidMapping。角色、人物和机构详情分别只返回自己的档案，没有人物或角色的反向游戏列表。官方当前目录提供机构游戏查询，没有同等的人物或角色查询；不支持这两类反查是当前公开接入范围，不等同于站点内部没有这些数据。

实时 Staff 使用 jobName、empName、empDesc、pid；CharacterRelation 使用 cid、cvId、characterPosition；发行记录使用 releaseName、relatedLink、releaseLanguage 等 camelCase 字段。不能照抄旧示例的下划线字段，也不为实时接口添加另一份字段回退。

Game 31147 的主图、网站、角色和多个职员岗位正常返回。职员存在原画、人物设计、脚本、音乐、歌曲及其他分类，并有实际作品说明。档案主名与本作署名是不同位置的信息。

Character 19366 的 birthday 为 3000-03-27；官方模型说明年份大于等于 3000 用于未知年份。Person 11333 返回完整生日，Organization 10041 的 birthday 本次缺席；不能因一条组织样本缺项否定文档声明的成立日期字段。

官方模型将 name 定义为原名，chineseName 为中文形式，extensionName 的 type、desc 是名称说明。Character 与 Person 的 gender 为 0、1、2、3，分别表示未知、男性、女性和来源另列的类别；具体本体映射属于设计选择。

moreEntry 是自由键值，文档示例包括补丁时间与价格，没有固定身体资料或其他本体字段目录。Game.releaseDate 明确指正式发售日期；haveChinese、country 和发行可用语种不直接表达原作语种。

## 结论边界

这些事实支撑[逐项设计](../../../design/extensions/sources/ymgal.md)的读取路径、字段及默认机构处理。名称选择、职责归并、默认原配名单采用与源码组织是已确认的设计规则，不能冒充上游保证。本次没有遍历全部档案、完整核对 24 部游戏，也没有验证所有无图资源；样本通过不代表完整 provider 已完成验收。
