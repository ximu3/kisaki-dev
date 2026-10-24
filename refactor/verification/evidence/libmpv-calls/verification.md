# libmpv-node 值与调用合同的来源核对

本页核对[调用合同](../../../design/projects/libmpv-node/api.md)所用的固定上游资料与源码，没有构建 addon、载入媒体库或运行图形程序。

## 固定来源

沿用[原生项目组织核对](../native-projects/organization-sources.md)记录的 mpv v0.41.0，提交为 41f6a645068483470267271e1d09966ca3b9f413，Client API 2.5。[source-probe.py](source-probe.py)实际读取五项源码，均返回 HTTP 200，URL、HTTP 状态、时间、摘要和关键标记行号已记录到[source-contract.json](source-contract.json)。标记存在只辅助定位，语义判断来自正文核对。

| 来源                                                                                                                | 本轮采用的事实                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [client.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h)    | 原生值含 INT64、DOUBLE、字节和非 UTF-8 字符串；异步操作通过事件回复，可重排；属性通知可能合并且不可用时不携带精确错误原因；取消命令是尽力请求 |
| [input.rst](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/DOCS/man/input.rst)     | 命令各有完成语义；screenshot-raw 含 w、h、stride、format、data，文档允许 padding 及负 stride                                                  |
| [screenshot.c](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/screenshot.c) | 截图尺寸与 stride 写入 INT64；字节结果引用图像平面，size 由 stride × h 得到；转换函数可能复用已有图像引用                                     |
| [node.c](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/misc/node.c)               | map 添加函数不检查同名键，不能仅凭 map 名称推断普通对象转换必定无损                                                                           |
| [render.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/render.h)    | 渲染上下文与核心有明确的建立和释放约束；不能由 Node 对象关闭直接推断原生清理已经完成                                                          |

## 设计判断与未完成范围

所有原生 INT64 统一 bigint、number 输入对应 DOUBLE、AbortSignal 结束等待、错误来源分开和 close 幂等，是已经确认的 Node 合同，不是上游已经提供的 JavaScript 行为。字节独立持有和已交付帧不阻塞 Mpv 关闭沿用已经确认的设计，也仍需真实实现验证。

非 UTF-8 文本与 map 键的正式表示见[值合同](../../../design/projects/libmpv-node/values.md)。本次源码观察还发现手册允许负 stride，而该版本截图实现用 stride × h 填充无符号 size；本试件没有复现负 stride 截图或证明全部路径的布局。实际布局与字节范围见[截图实测](../libmpv-screenshot/screenshot.md)。

事件丢失后的公开终止与继续规则、完整声明、真实 addon 的迟到回复与清理、截图布局、最终依赖制品和 GPU 交接仍未验证。没有用模拟对象、来源下载成功或静态类型声明将这些项目标为通过。
