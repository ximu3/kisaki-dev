# VNDB 职员版本范围验证

验证日期：2026-10-11。通过 POST /vn 读取 v17 的 titles、editions 和 staff，返回 HTTP 200。完整请求、时间与响应保存在[版本职员样本](2026-10-11-edition-credits.json)中；字段含义依据 [Kana API 官方文档](https://api.vndb.org/kana)。

样本为 Ever17 -the out of infinity-，返回 92 条职员记录，分布如下：

| staff.eid | 来源版本                                           | official | 职员记录数 |
| --------- | -------------------------------------------------- | -------- | ---------- |
| null      | 原版                                               | 不适用   | 42         |
| 0         | Hirameki International's translation，英语         | true     | 2          |
| 1         | Rokumei City's translation，英语                   | false    | 15         |
| 2         | PSP edition                                        | true     | 15         |
| 3         | Premium edition                                    | true     | 1          |
| 4         | WinKiller Studio & SanLtd Team's translation，俄语 | false    | 17         |

记录数是来源 staff 数组中的行数，不是不同人物数量，也不包括本次未请求的配音数组。staff.eid 为 null 表示原版，0 则对应真实的第一项版本。版本条目中的 lang 可以为空，不能据此补造语言。

样本证明同一 VN 的职员资料包含原版、官方和非官方版本的参与。已确认的[原版采用规则](../../../design/extensions/sources/vndb.md#staff-scope)只保留 staff.eid 为 null 的 42 条记录，再按人物与职责归并；其余 50 条版本记录不进入自动职员名单。这个验证不证明开发、发行或配音数组具有相同的原版标记。
