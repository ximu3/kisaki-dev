# VNDB 开发与发行范围验证

验证日期：2026-10-11。两次公开 POST 请求均返回 HTTP 200，原始请求与响应保存在[发行范围样本](2026-10-11-release-scope.json)中。字段依据 [Kana API 官方文档](https://api.vndb.org/kana)解释。

## 来源结构与实际结果

官方 API 将 VN.developers 定义为关联发行记录中标为开发方的所有主体。它不表示首次发行的开发名单。Release 提供 official、patch、languages、released、针对各 VN 的 rtype，以及 producer 的 developer、publisher 标志，但没有与 staff.eid = null 对等的原版标记。

样本作品为 v17，Ever17 -the out of infinity-，olang 为 ja，released 为 2002-08-29。VN.developers 返回 KID（p8）与 SDR Project（p19579）。

第二次请求筛选关联 v17、包含原作语种、官方、非补丁及完整发行的记录，按 released 排序，返回 23 条，more 为 false。逐条核对后，每条记录针对 v17 的 rtype 均为 complete，且包含日语、official 为 true、patch 为 false。本次请求已覆盖这个筛选范围，没有进行跨页请求。

其中最早日期为 2002-08-29，同日有三条记录：

| 发行 ID | 平台                      | 开发方 | 发行方          |
| ------- | ------------------------- | ------ | --------------- |
| r280    | Dreamcast                 | KID    | KID             |
| r2427   | PlayStation 2             | KID    | Electronic Arts |
| r2479   | PlayStation 2，首发限定版 | KID    | Electronic Arts |

这三条记录按主体身份归并，开发方为 KID，发行方为 KID 与 Electronic Arts。以上归属仅说明 VNDB 样本如何标记，不代表独立核实了发行历史。

全部 23 条记录还包含 SDR Project、SUCCESS、CYBERFRONT、MAGES.、DMM.com LLC 等主体。SDR Project 作为开发方出现在 2003-11-27 和 2014-05-30 的后续记录中，证明直接使用 VN.developers 会超出样本的首次发行范围。

## 已确定的采用规则与验证范围

已确认采用[首个正式原语种完整版的开发与发行规则](../../../design/extensions/sources/vndb.md#first-release)：在原作语种的官方完整、非补丁发行中确定最早日期，保留同日不同平台的真实开发与发行主体。不能只取排序后的第一条，也不能把日期排序称为来源直接提供的原版标记。这一署名采用范围与作品首次正式公开的普通 releaseDate 字段分开；后者可以包含官方的部分发行。

本样本验证了同日多条发行的归并依据，以及直接使用 VN.developers 会引入后续主体的问题；没有验证日期不完整、需要跨页或其他作品的情况。
