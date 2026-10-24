# VNDB 作品关系范围验证

验证日期：2026-10-11。一次公开 POST /vn 查询返回 HTTP 200，完整请求与响应保存在[直接作品关系样本](2026-10-11-work-relations.json)中，顶层 more 为 false。

## 字段与来源定义

[Kana API](https://api.vndb.org/kana)将 relations 定义为当前 VN 的直接相关作品，同时提供关系类型 relation 和布尔值 relation_official。[作品编辑规范 Relations 节](https://vndb.org/d2#5)于同日直接读取返回 HTTP 200，要求只添加直接联系，并说明反向关系由源站维护。

该规范中的 official 表达源站认定的官方关系，非官方联系也能使用前作、续作、共用角色等类别。这是关系的标记，不能由作品名称、是不是同人作品或关系类别的字面名称自行代替，也不构成本体独立核实的授权结论。

## 实际返回范围

| 作品                              | 关系总数 | relation_official 为 true | relation_official 为 false |
| --------------------------------- | -------- | ------------------------- | -------------------------- |
| v11，Fate/stay night              | 50       | 4                         | 46                         |
| v17，Ever17 -the out of infinity- | 4        | 3                         | 1                          |

以上数字均为本次来源数组行数，不表示已经在本体建立关系或核实两端的本地身份。

v17 的四项直接关系如下：

| 目标                                  | 来源类别 | 来源官方标记 |
| ------------------------------------- | -------- | ------------ |
| v13，Remember11 -the age of infinity- | ser      | true         |
| v19373，Ever17                        | alt      | true         |
| v248，Never7 -the end of infinity-    | ser      | true         |
| v3794，Ever17 CrossOver Impression    | seq      | false        |

最后一项说明只读取 seq 并转换为续作，会丢失源站对该关系的非官方限定。v11 还包含大量 relation_official 为 false 的 char、preq 等记录，不能把这些类别本身当成官方关系保证。

## 已确定的采用范围

已确定[官方作品关系规则](../../../design/extensions/sources/vndb.md#work-relations)：只采用 relation_official 为 true 的直接关系，再解释关系类型和方向。按此范围，v11 保留四条关系，v17 保留三条，v3794 的非官方续作关系不进入资料回答。

这项范围只约束该资料来源自动提供的作品联系，不限制作品独立编目，也不改变用户手动建立关系的能力。同系列不自动创建合集、共用角色不推导其他创作关系，来源链接也不会递归扩展整个资料图。

## 反向关系与 Fandisc

另一次公开 POST /vn 查询返回 HTTP 200、more 为 false，原始结果见[关系方向样本](2026-10-11-relation-directions.json)：

| 方向         | 来源类别 | 官方标记 |
| ------------ | -------- | -------- |
| v11 → v50    | fan      | true     |
| v50 → v11    | orig     | true     |
| v11 → v9888  | side     | false    |
| v9888 → v11  | par      | false    |
| v17 → v19373 | alt      | true     |
| v19373 → v17 | alt      | true     |

前一个文件保存正向记录，后一个文件保存相应的反向记录。side／par 样本只用于核对方向，不因用于验证就进入已确定的官方采用范围。

同日读取[源站 v11 页面](https://vndb.org/v11)返回 HTTP 200，其中 v50 位于 Fandisc 一栏，与 API 的 fan 对应。该来源值不能被解释成“非官方同人作品”：同一类别下也有 relation_official 为 false 的记录，官方性必须读取独立标记。

另读取 v11、v17、v50、v9888 的公开页面，将相同目标的页面关系标题与已保存的 API 类别对应，四次 GET 均返回 HTTP 200。[页面称谓样本](2026-10-11-relation-labels.json)保存十个来源代码的实际称谓及示例链接，不保存完整页面。它用于确认 seq／preq、side／par、fan／orig 等代码的含义，不能代替本体关系映射的语义判断。

已确认按本体既有的[外传与补充故事关系](../../../design/domains/relations.md#work-relations)表示 Fandisc：fan 对应 sideStory，orig 对应 mainStory，均保留 Fandisc 说明。它不需要独立类型，也不降为普通关联。v11 → v50 的 fan 与 v50 → v11 的 orig 规范化后是同一条以 v11 为本篇、v50 为补充故事的关系，不能生成镜像。
