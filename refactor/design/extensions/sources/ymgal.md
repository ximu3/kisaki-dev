# YMGal 接入设计

YMGal 通过在线 API 提供游戏、角色、人物与组织资料。本文定义对象、字段、关系、读取上下文及源码组织。

<a id="ymgal-scope"></a>

## 在线接入范围

扩展只提供在线资料和应用访问配置，不提供个人账号、清单导入或同步，也不提供官方资料集的下载、更新、本地索引与读取。

资料通过官方开放 API 读取，应用令牌使用 public scope，不代表用户登录。公开默认配置和自定义应用凭据分别管理；只提供“资料采集”一个 Webview 页面，包含配置保存、连接测试及连接结果。配置保存与联网测试分别执行，失败不丢弃格式合法的设置。

<a id="identities"></a>

## 对象身份与搜索

正式 source 为 ymgal，sourceId 使用官网资源前缀与规范十进制 ID。类型来自实际档案，不由名称、岗位或网址中的其他数字推断。

| 来源对象     | 本体类型     | sourceId | 详情读取                  |
| ------------ | ------------ | -------- | ------------------------- |
| Game         | Game         | ga31147  | /open/archive?gid=31147   |
| Character    | Character    | ca19366  | /open/archive?cid=19366   |
| Person       | Person       | pa11333  | /open/archive?pid=11333   |
| Organization | Organization | oa10041  | /open/archive?orgId=10041 |

四类对象分别提供 resolve 和按身份读取。名称搜索只提供 Game，使用 /open/archive/search-game 的 mode=list、keyword、pageNum 和 pageSize，保留来源顺序，单页最多 20 项。精确搜索模式返回最相似项，不能作为唯一身份确认。名称定位仍完整读取本次必要候选，再交付 candidates；只有真实身份或同一目标的明确映射才能 resolved。

Character、Person、Organization 不提供名称搜索。仅有名称而没有有效同源身份或明确跨站映射时，resolve 返回 insufficientInput，不将缺少查询手段表述为 notFound。有效身份的类型不符也不能换成另一个目标。

oa666 是来源明确说明的“默认机构”：游戏没有开发商时指向该占位档案。它不成为 Organization，不参与搜索、resolve 或关系成员。遇到 developerId=666 表示开发方未知，不能据此返回权威空组织集合并清除已有关系。

本接入采用来源 Character、Person、Organization 的明确类别。Character 没有 Bangumi 式机体、舰船分类可供筛选，按该站角色档案采用；不另用简介推断人格。只提供上述四类 Entry，不提供 Anime、Comic、Novel 或 Part。游戏 releases 是发行版本资料，不据此生成新作品、分部或作品关系。

<a id="read-paths"></a>

## 读取上下文与关系能力

| 根上下文     | 根字段   | 可枚举关系及属性                                                       |
| ------------ | -------- | ---------------------------------------------------------------------- |
| game         | 游戏字段 | workCharacters：role；personWorks：note；organizationWorks：无附加属性 |
| character    | 角色字段 | 不枚举关系                                                             |
| person       | 人物字段 | 不枚举关系                                                             |
| organization | 组织字段 | organizationWorks：无附加属性                                          |

四个上下文均支持在合法的 relatedEntries 节点中按明确 ymgal refs 读取游戏、角色、人物和组织字段；根对象仍通过 entry 返回。相关字段读取不产生关系成员，也不要求具有同源根身份。没有根 identity 时，不枚举或推造根关系。

游戏详情提供 characters、staff、developerId，并附带 cidMapping 与 pidMapping。附带映射用于复用已经返回的档案，普通字段不足时补读相应详情；不能仅凭映射表出现某个对象就建立关系。

组织反向查询使用 /open/archive/game?orgId=<id>，该接口按合同返回完整数组。逐个补读游戏详情，核对 developerId 后只交付当前组织的开发关系，不将接口命中直接解释为发行关系。人物和角色详情没有反向作品列表；不遍历全站游戏、不下载资料集，也不通过已访问过的零散缓存冒充完整履历。

搜索按分页信息续读，关系读取取得全部必要名单和依赖详情后才回答。未回答、明确空值和失败沿[集合完整性](../providers.md#read-completeness)分别处理；同次会话按来源身份复用请求，不按显示名去重或递归抓取整张资料图。

<a id="fields"></a>

## 普通字段、正文与图片

| 对象              | 支持的普通字段                                                        |
| ----------------- | --------------------------------------------------------------------- |
| 四类档案共有      | name、originalName、aliases、description、primaryImage、externalLinks |
| Game 追加         | releaseDate、isNsfw                                                   |
| Character 追加    | birthDate、gender                                                     |
| Person 追加       | birthDate、gender                                                     |
| Organization 追加 | foundedDate                                                           |

以上目录同时用于根和相关对象。未列出的字段不声明；不把 haveChinese、country 或 releaseLanguage 当作 originalLanguages，不从图片推断敏感标记，不将档案发布时间当作作品发行或主体生卒时间。

| 来源值                           | 采用规则                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| name、chineseName、extensionName | name 按已明确标注的语言形式及 preferredLanguages 选择；未标注语言的别名不凭文字形态参加语言选择。没有匹配时采用主 name。chineseName 是来源给出的中文形式，不承诺简繁转换 |
| 主 name                          | originalName；官方档案合同将其定义为原名，人物艺名也可以是档案主名，不改为本名字段                                                                                       |
| extensionName 及实际其他名称形式 | aliases；保留完整名称，按共同名称规则去重，不把 type、desc 或简介当作别名                                                                                                |
| introduction                     | description；保留原介绍，转为共同 Markdown，正文中的安全链接、图片按共同规则处理                                                                                         |
| mainImg                          | 当前档案 primaryImage；空地址不生成候选，不从其他档案复制主图                                                                                                            |
| website 的 title、link           | 当前对象的 externalLinks，另保留当前档案页面；角色没有 website 字段时不补造网站列表                                                                                      |
| Game.releaseDate                 | 来源明确的正式发售日期；不从 releases 中挑最早试玩日期替代                                                                                                               |
| Game.restricted                  | 当前游戏 isNsfw；不传播到其角色、人物和组织                                                                                                                              |
| Character／Person.birthday       | birthDate；日期年份大于等于 3000 按来源“年份未知”约定省略 year，保留合法月日                                                                                             |
| Organization.birthday            | foundedDate，沿同一未知年份编码                                                                                                                                          |
| gender                           | 0 为未知，1 为 male，2 为 female，3 按来源的其他性别分类采用 other，不改成 nonBinary                                                                                     |

日期整体校验，保留已知精度，不补月份、日期或当前年份。比如 3000-03-27 采用为 { month: 3, day: 27 }，不会显示为公元 3000 年出生。无效日期不修补成另一日期。

moreEntry 是自由键值资料，当前没有核验到可作为稳定字段合同的补充键目录。本接入不据此声明额外身体、生卒、语言或标签能力，也不整表附加到简介、转成标签或保存为隐藏属性。原介绍本来包含的内容正常保留，其他资料可通过来源页面查看。

本接入没有可用的独立剧透标志，不为关系填充虚假的 isSpoiler=false，也不根据未标记的正文自动分析剧情。正文只做格式与安全转换，不执行来源脚本或载入站点界面组件。

图片读取只支持四类档案的 primaryImage，不提供 backdropImage、titleLogo、iconImage。独立图片候选浏览只为 Game 提供，通过游戏搜索或明确游戏身份取得主图；其余三类主图仍可通过明确 refs 随资料读取，不增加不存在的名称检索。

网站链接指向的发行版、商店包和组织主页分别保留其真实范围。只有明确属于当前对象且符合目标来源资源语法的链接才贡献 externalIdentities；官中网页不自动成为另一份作品身份。

<a id="relations"></a>

## 游戏参与与配音

characters 中的 cid 对应真实 Character；characterPosition=1 对应 main，2 对应 supporting，其余未定义值不猜成 cameo 或 other。没有可采用定位时该属性不回答，不影响已明确的角色登场关系。

staff 中的 pid 对应真实 Person，empName 是本次署名，不能覆盖人物主档案名称；原岗位、不同署名与 empDesc 在选中 note 时合并保留。同一工作按本体业务键归并。pid 缺席但来源明确提供人员署名时，可以提供无正式来源身份的人物名称，不把 sid 变成人物身份；本体仍执行正常 matching。

| 来源岗位                     | 人物职责                         |
| ---------------------------- | -------------------------------- |
| 原画、插画、CG、SD 原画      | illustration                     |
| 人物设计、角色设计           | characterDesign                  |
| 剧本、脚本                   | scenario                         |
| 监督、导演                   | director                         |
| 演出                         | direction                        |
| 音乐、歌曲、作曲、编曲、演唱 | music                            |
| 音响、音效、录音             | sound                            |
| 程序、程序开发               | programmer                       |
| 制作人、企划                 | producer                         |
| 明确配音岗位                 | voiceActor，不凭岗位关联全部角色 |
| 其他已确认的制作署名         | other，保留原称谓和说明          |

游戏参与采用主档案中的制作署名，译版专属工作按来源明确标记排除。developerId 提供开发关系；game 与 organization 上下文中的 organizationWorks 使用固定 scope：[{ workTypes: ['game'], roles: ['developer'] }]。发行主体需要独立署名依据，本接入的版本字段仅按已定义资料采用。

characters 中的非空 cvId 已直接给出游戏、角色和人物的三方配音事实，按相应 Person 读取。来源没有独立配音语种字段，本接入约定将游戏主档案的这组配音作为默认原配名单采用；这是接入采用约定，不证明每条社区资料都正确。明确标注的译配不进入工作关系，发行版本支持的语言不用于推断配音语种。

角色与人物的别名不产生另一份身份；cvId 与 staff 中的同一人物也不因署名不同复制档案。不从职员备注里的角色名字自动建立角色设计或插画的三方关系。

<a id="runtime"></a>

## 应用访问与运行边界

Node 客户端持有应用令牌、请求队列与短期缓存；自定义凭据进入 secrets，页面只取得必要的配置状态。所有开放接口请求带 version:1，并同时检查 HTTP 与 success/code；HTTP 200 不足以证明成功。来源认证错误只触发一次重新取令牌与安全读取重试，限流和普通网络失败不清除凭据，不无限循环认证。

请求在同一客户端内串行调度并复用同次读取结果，避免并发放大公共应用配额。切换配置使后续请求使用新配置，旧响应不能覆盖新连接状态。扩展停用、实例失效和取消沿共同执行合同处理，不在启动时预拉取全站资料。

<a id="organization"></a>

## 源码组织

使用 Node + Webview 模板，各模块直接承担实际职责：

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/
│   │   ├── client.ts
│   │   ├── credentials.ts
│   │   ├── validation.ts
│   │   └── types.ts
│   ├── metadata/
│   │   ├── provider.ts
│   │   ├── session.ts
│   │   ├── identity.ts
│   │   ├── fields.ts
│   │   ├── relations.ts
│   │   ├── description.ts
│   │   └── images.ts
│   ├── ipc.ts
│   └── settings.ts
├── webview/
│   ├── index.html
│   ├── entry.tsx
│   ├── pages/metadata/
│   └── styles.css
└── shared/
    ├── contracts.ts
    └── validation.ts
```

client 负责来源 HTTP、应用令牌、串行请求和响应解析；metadata 负责本页身份、字段与关系，能力范围限于公开资料。settings 保存非秘密配置，ipc 连接页面与完整配置操作，entry 负责装配和登记。

<a id="verification"></a>

## 证据与验收

来源依据见[公开接口核验](../../../verification/evidence/ymgal/public-contracts.md)及[字段与读取路径核验](../../../verification/evidence/ymgal/metadata-mapping.md)。完整实现按下列场景验收。

实现须覆盖四类身份和类型冲突、oa666、无年份生日、主名与署名、仅游戏名称搜索及完整续页、机构反查后的开发方核对、缺少人物与角色反查时的能力拒绝、按 refs 读取、无图、HTTP 200 失败、令牌失效与限流。预设不能再在人物或角色根上下文中请求 YMGal 的反向关系；不读取资料集和不建立个人入口分别验收。
