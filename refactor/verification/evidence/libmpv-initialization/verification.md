# libmpv-node 初始化合同的检查范围

对应已确认的[初始化入口](../../../design/projects/libmpv-node/lifecycle.md)。来源收据保持执行当时的 proposal 状态，不因确认设计改写历史检查结果。本轮只读取固定上游源码并检查局部声明，没有实现或运行 createMpv，也没有执行配置文件、脚本或图形初始化。

## 固定来源

[source-probe.py](source-probe.py)记录 mpv v0.41.0 固定提交的 HTTP 状态、时间、SHA-256 与定位行，并读取实际 libmpv 内置 profile 的默认选项。标记定位只帮助检查来源，不能证明原生运行行为。

| 来源                                                                                                               | 核对内容                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [Client API](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h) | 创建与初始化分开；未初始化句柄的并发限制；初始化选项及 mpv_set_option 的现行地位 |
| [客户端实现](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/client.c)      | 应用 libmpv profile；选项设置；未初始化属性设置转发和错误重分类；同步初始化入口  |
| [嵌入默认选项](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/etc/builtin.conf)   | config=no、terminal=no、idle=yes 与其他实际默认项                                |
| [核心初始化](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/main.c)        | 早期日志、配置文件与脚本在初始化期间的参与                                       |
| [Render API](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/render.h) | 单一渲染上下文及销毁顺序                                                         |
| [渲染实现](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/video/out/vo_libmpv.c)  | 上下文取得全局状态和登记的实际路径；未据此推断初始化前调用已获完整支持           |

实际读取结果见 [source-contract.json](source-contract.json)。早期 terminal-default 缓冲与日志级别的来源核对继续见[通知检查](../libmpv-notifications/verification.md)。

## 声明消费

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-initialization/tsconfig.json
```

[contract.d.ts](contract.d.ts)与 [consumer.ts](consumer.ts)检查有序选项、按名称关联值、未知名称入口、原生输入、初始化日志的独立输出选择与取消参数。声明复用控制模块的 Mpv 与视频模块的输出类型，并作为唯一创建入口联合检查 GPU、软件、无输出和动态可选配置。额外客户端、hook 与流提供器继续由同一个 Mpv 拥有；没有伪造真实运行时实现。初始化日志的 createMpv operation 已补齐，真实错误构造与传递仍未验证。

TypeScript 6.0.3 在 NodeNext、Node 类型、strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess 和 noEmit 下以退出码 0 完成。覆盖两种选项输入与三种日志输出选择的组合，10 项 @ts-expect-error 反例均被拒绝。首次检查的一个反例因格式化换行而使诊断落在字段行，已把反例输入提取为常量并重新通过；没有放宽声明。

## 尚未验证

输入复制、实际选项设置顺序、配置文件优先级、初始化日志登记和有界交付、取消与原生清理、脚本引发的加载／退出、受管渲染准备、Node 环境退出及全部平台制品均未验证。没有用一个模拟工厂状态机替代这些证明；完成来源和声明检查不代表可以把剩余公共行为交给实施者自行决定。
