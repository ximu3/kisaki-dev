# VNDB 配音备注补充样本

验证日期：2026-10-11。新增三个作品的公开查询返回 HTTP 200，完整请求与响应见[补充备注样本](2026-10-11-additional-voice-notes.json)。原作语种均为 ja，记录数为 va 数组行数。

| 作品                                               | 配音备注                        | 记录数 |
| -------------------------------------------------- | ------------------------------- | ------ |
| v7679，Super Dangan Ronpa 2                        | Japanese                        | 18     |
| v7679，Super Dangan Ronpa 2                        | English (Uncredited)            | 18     |
| v7809，Kyokugen Dasshutsu ADV - Zennin Shibou Desu | Japanese                        | 13     |
| v7809，Kyokugen Dasshutsu ADV - Zennin Shibou Desu | English                         | 13     |
| v7809，Kyokugen Dasshutsu ADV - Zennin Shibou Desu | English (original release)      | 1      |
| v7809，Kyokugen Dasshutsu ADV - Zennin Shibou Desu | English (The Nonary Games port) | 1      |
| v18131，Maitetsu                                   | 空备注                          | 20     |

样本显示备注确实承载语种说明，但也存在没有语种备注的名单。English (original release) 中的 original release 不能被当作本作原语种依据；该记录明确标为英语，而作品 olang 为 ja。演员 lang 未用于本次语种判断。

已确认[来源采用约定](../../../design/extensions/sources/vndb.md#voice-scope)：排除明确标注的非原语种记录，未标语种时按作品原语种采用。按此规则，v7679 保留 18 条、排除 18 条；v7809 保留 13 条、排除 15 条；v18131 的 20 条空备注记录全部采用。以上数量是筛选后的来源行数，尚未按本体关系业务键归并。

这个约定依赖适配器识别明确语种标注、源站标明译配，漏标记录仍可能被误收；它不是接口提供的原生语种筛选，也不证明源站全量资料均符合约定。产品仍不支持译配，采用阶段保留备注，不能用声优母语或括号中的版本称谓覆盖明确语种。
