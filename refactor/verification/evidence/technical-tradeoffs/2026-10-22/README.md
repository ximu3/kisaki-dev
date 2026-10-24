# 日期、界面隔离与工具维护范围复核

本目录记录日期、虚拟化、Webview 隔离、RPC 与开发工具的隔离试件及源码比较。对应规则见[日期](../../../../design/domains/values.md#years)、[虚拟化](../../../../design/ui/virtualization.md)、[消息协议](../../../../design/engineering/protocols.md#frames)、[工作区](../../../../design/engineering/workspace.md#tasks)和[Webview](../../../../design/extensions/webview.md#isolation)。结果只覆盖所列候选版本与实验环境。

<a id="dates"></a>

## 日期范围：保留共同值域

日期保留 year／month／day 的七种非空组合，以及正负全部 JavaScript 安全整数年份。未知月份和日不补齐，字段仍使用 number 或整值 null。日期事实按分量比较，与受时区及时间点范围约束的 createdAt 等字段保持不同含义。

[日期试件](date-probe.cjs)在 Electron 41.2.0、Node 24.14.0 与实际 better-sqlite3 使用的 SQLite 3.53.2 中通过 7 组断言，见[原始结果](date-results.json)：

| 检查           | 实际范围                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------ |
| 公历合法性     | 2000–2399 年、每月日值 0–32，共 158,400 个输入，与 UTC 日期规范化结果独立对照              |
| 未知分量       | 七种组合准确往返，拒绝空对象、非法分量与未知键；负零规范为 0，坏 JSON 读为空               |
| 极端年份       | 正负安全整数两端附近共 2,000 个年份的闰年规则，与 BigInt 精确余数核对                      |
| 年号输入与显示 | 四种语言环境的年号数字格式化、解析、跨纪元和两端值；最小内部年份对应的公元前年号可准确往返 |
| 区间语义       | 年／年月／完整日的包含关系、年加日但缺月、无年日期、跨年的月日范围及整月未知日             |
| SQLite         | 77 个日期值的缺省分量和整数提取；6 组绝对范围的结果、count 与位置一致                      |

边界处确有一个需要明确的实现细节：内部 year = -9007199254740991 对应公元前 9007199254740992 年。这个显示年号不能先转换为不再安全的 number。编辑器先保留数字文字，纯模块临时用 BigInt 完成精确换算，再检查并形成正式 year；数据库和公共 API 不接收 BigInt。

本轮结果支持保留现有合同，没有发现必须通过收窄字段来解决的核心运算问题。它不证明全部来源映射、实际四语表单、时区日界或完整日期 UI 已完成；这些仍按正式实现验收。158,400 个输入是一个公历周期的规则对照量，不是同等数量的产品场景。

<a id="virtualization"></a>

## 虚拟化：采用现有几何实现

[TanStack Solid 适配](https://tanstack.com/virtual/latest/docs/framework/solid/solid-virtual)提供框架接入，[Virtualizer 公共 API](https://tanstack.com/virtual/latest/docs/api/virtualizer)提供数量、尺寸测量、稳定 key、范围提取和滚动能力。本轮使用 @tanstack/solid-virtual 3.13.48、@tanstack/virtual-core 3.19.6、Solid 1.9.16、Vite 8.3.3 和 vite-plugin-solid 2.11.14，实际构建后在 Electron 41.2.0／Chromium 146 中运行。

试件没有构造全量 Entry 数组，按数量及算术行映射提供几何 key。库会计算完整几何索引，页面只呈现所需窗口。查询、分组和真实身份仍需由 Kisaki 提供；几何依赖没有替应用实现这些业务。

| 输入              | 本次同步设置／重测耗时 | 初始／远处挂载行数 | 远处目标 |
| ----------------- | ---------------------- | ------------------ | -------- |
| 1,000 行固定高度  | 13.1 ms                | 21／26             | 实际可见 |
| 10,000 行固定高度 | 4.0 ms                 | 21／26             | 实际可见 |
| 50,000 行固定高度 | 14.0 ms                | 21／26             | 实际可见 |
| 50,000 行动态高度 | 18.3 ms                | 21／26             | 实际可见 |

这里是同一页面顺序执行的单次观测，不是多轮分位数或正式性能预算。设置步骤同时包含数量／模式变化与显式 measure，因此 key 和 estimateSize 的调用合计为 2N；不能由此声称库每次初始化必定运行两遍。后续远处跳转没有新增这些估算回调。JS 堆的原始观测随垃圾回收变化，不能作为应用峰值内存或纯索引增量。

另外通过两项交互断言：

- 当前可见锚点之前的一行增高 72 px 后，同一锚点及其行内偏移保持。
- 含 50 组的合成网格从五列变为三列，逻辑行数分别为 10,050 与 16,750；按明确目标重新映射和滚动后，原目标仍实际可见。仅挂载 17 行，分别为 85 与 51 张合成卡片。

测试用 [virtual-probe.jsx](candidates/virtual-probe.jsx) 和[运行器](virtual-electron.cjs)，结果见[原始 JSON](virtual-results.json)。原先普通隐藏窗口未在期限内结束，其[未完成结果](virtual-before-offscreen.json)保留；改为 Electron offscreen 页面后完成。运行时关闭硬件加速，没有测量真实显示器上的 FPS、输入延迟或 GPU 性能。

因此将规范改为采用这项依赖，并允许按行数增长的几何索引；普通业务数据仍只保留可见与预取区间。正式卡片、图片、字体、快速滚动、拖拽、读屏、跨窗口数据与查询并发仍需验证。几何通过不等于完整列表已通过验收。

<a id="rpc"></a>

## RPC：保留有限内核的责任

比较对象是 [birpc](https://github.com/antfu-collective/birpc) 4.2.0。已安装版本提供双向请求、事件、关闭及关闭监听；可通过 timeout: -1 停用默认调用超时，通过 proxify: false 使用显式调用。它可以作为项目的调用基础，并非缺少基本能力。

[MessageChannel 试件](candidates/rpc-probe.mjs)使用 Node 24.11.1，实际通过 7 组断言，见[结果](rpc-results.json)：双向嵌套、同时调用、事件、普通安全错误值的完整传递、原生 Error 自定义字段的丢失、断连后远端已开始工作仍可结束，以及监听释放。

后两项尤其明确了本项目仍需拥有的边界：通信结束不代表业务回滚，code／partialResult 不能依赖原生 Error 的结构化克隆。候选没有直接交付当前规格要求的版本握手、严格帧校验、按调用取消、真实实例绑定与资源寿命；它们可以通过接入代码补充，但不能在采用候选后从责任清单中删除。

用户确认继续维护当前有限 RPC 内核，使请求关联、取消与连接寿命按同一帧合同处理。通用包只承担通信机制，权限、业务校验、资源归属和运行流程留在实际端点；不发展任意远程对象、持久调用重放或通用事务系统。

本轮只运行了候选库试件。自研内核仍待 W01 实现并完成同等基础行为及本项目新增边界的验证；不能将这里的 7 组通过结果记为自研内核已经通过。

<a id="development"></a>

## 开发会话：保留项目自己的流程

本轮检查 [electron-vite](https://github.com/alex8088/electron-vite) 6.0.0 的实际发行代码和声明。其公开配置包含 main、preload、renderer，并导出对应配置工厂；默认 createServer 的返回类型为 Promise<void>，自行启动 Electron。main 成功重建时，它结束已有进程并启动新的进程；preload 重建时向 renderer 发送刷新通知。这些是其默认开发流程的具体行为，不是对所有组合方式的限制。

| Kisaki 需要管理的事实          | 当前方案的责任                                     |
| ------------------------------ | -------------------------------------------------- |
| 第四个独立 extension-host 程序 | 明确的构建输入、输出与替换范围                     |
| 多公共包与官方扩展的首次就绪   | 依赖构建及完整制品交接后才开放消费者               |
| 开发应用与 kisx 会话           | 唯一启动器、明确会话身份和采用结果                 |
| 重启、退出与失败               | 原生流程完成所需处理，按实际进程句柄与资源寿命收尾 |
| 编译、解析与 HMR               | 使用 Vite 公开 API 和正式插件，不重新实现这些机制  |

配置工厂可以复用部分 Electron 缺省，但无法替本项目持有上述应用流程。用户确认继续直接使用 Vite；自有代码的范围限于程序配置、依赖就绪、资源准备及进程交接，不扩大为通用构建框架。

本轮没有运行 electron-vite 的完整开发会话，也没有修改其代码或验证跨平台重启。以上比较依据固定版本的发行源码；[源码摘要](source-observations.json)保存检查文件的 SHA-256，不能把源码阅读称作运行验收。

<a id="projects"></a>

## 独立项目与文档职责

用户确认 Vantage、Kana、libmpv-node 和 oauth-relay 均作为长期独立技术产品。各自的公开范围继续以项目合同为准，不收窄成 Kisaki 当前几处调用的内部包装；独立版本、示例、兼容性和发行维护成本明确保留。[项目定位](../../../../design/projects/README.md#purpose)现已对应到每个项目的独立目的和 Kisaki 消费场景。

这项确认是范围决定，不增加项目实现或平台运行证据。Kisaki 通过公开制品检验新增的业务接入，独立项目仍须自行验证其完整承诺；没有虚构其他真实用户或市场需求来证明范围。现有来源依据、支持限制、原生资源与上游安全边界继续保留。

文档整理把验收页的“最终工程结构”改为规则来源、检查证据及通过条件的索引，原有 18 个唯一设计来源全部保留。领域与工程主题继续拥有完整规则；验收保持可观察的要求，避免再维护一套架构描述。查询语义、查询值形状、写入完整行为、条件基线、调用语义和消息帧各自的文档责任也已说明。

<a id="webview"></a>

## Webview：实际来源与 Worker 的资源限制

用户确认允许第三方页面按浏览器规则请求 HTTPS／WSS 数据；页面和脚本由扩展包提供，外部网站通过明确动作在系统浏览器打开。官方扩展的业务请求、账号和凭据继续在 Node。规范补充每视图独立来源、原生 preload 与 SDK 的边界、完整 CSP、导航和权限拒绝，以及开发环境的有限例外。

[Electron 运行器](webview-electron.cjs)、[原生 preload](webview-preload.cjs)、[宿主页](webview-parent.js)和[视图脚本](webview-child.js)在 Electron 41.2.0／Chromium 146 的隔离 offscreen 窗口实际执行。启用 sandbox、contextIsolation、webSecurity，关闭 Node 集成，使用独立非持久 Session；没有载入用户扩展、资料或账号。

[最终结果](webview-results.json)中 20 项页面条件及 11 项运行器检查全部通过。后者包含汇总与交叉核对，不能相加宣称 31 个互相独立的场景。具体范围如下：

| 边界       | 实际观察                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 来源与桥接 | 两个视图的 Chromium origin 不同；不能读取父页面和另一个视图 DOM；原生 preload 标记只在父页面存在，子页没有 Node 全局 |
| 脚本与数据 | 包内脚本、JSON 和 Worker 正常；内联、eval、远端及 blob 脚本拒绝；HTTPS 合成数据可读，HTTP 数据请求拒绝               |
| 资源       | 自有资源可由页面及包内 Worker 读取；另一视图及其 Worker 无法读取已知的同一资源地址                                   |
| 通信与导航 | 伪造消息未被接纳；跨视图导航拒绝，包内新文档建立第二个端口；外部页面被父 CSP 拒绝并产生真实加载失败                  |
| 权限与窗口 | 地理位置的检查和请求均经过真实 Session 处理并拒绝；ServiceWorker 未成功登记；弹窗与顶层导航由 sandbox 拒绝           |

补测发现了一个不能省略的反例：[宽泛资源策略结果](webview-broad-resource-results.json)中，普通页面的越权请求被 webRequest 拒绝，但包内 Worker 的资源请求直接到达 protocol.handle，没有对应的 onBeforeRequest 记录，处理器收到的 Origin 也为空。另一视图的 Worker 实际读到了试件字节。这份结果明确失败，不能用其他检查通过掩盖。

最终策略在页面和每个 Worker 脚本响应中都列出本视图精确的资源来源；不放行整个 kisaki-resource 协议。相同 Worker 反例随后被 CSP 拒绝，自有读取仍成功。正式资源注册表还需管理真实占用、失效和撤销，CSP 也不替代正式端点授权。试件使用固定的来源名称便于复现，正式实现使用宿主生成的不可预测运行身份。

另一个观察是：外部导航可能先被父 CSP 拒绝，没有到达 will-frame-navigate，并使原文档进入失败状态。规范因此要求同时处理 CSP、导航事件和失效文档清理；不能承诺每次拒绝都会完整保留旧文档。包内同源导航与跨视图导航则实际经过该事件。

试件为定位测试特意在一个 iframe 委托 geolocation，使请求能够到达 Session 处理器；正式页面不委托该权限。popup 在 sandbox 层已被拒绝，因此本次没有触发 setWindowOpenHandler，不声称其运行分支已覆盖。父子通信只验证实际来源、端口交接和文档替换，不是完整 SDK 握手、取消或故障恢复验收。

HTTPS 数据由本次 Session 的协议处理器返回合成响应，证明 CSP 下的数据读取路径，不证明真实 TLS、CORS、Cookie、WSS 或代理。完整预加载 IPC、包路径越界、资源缓存与撤销、嵌套页面、各框架正式构建、开发 HMR、外部浏览器打开及其他浏览器权限仍按[正式场景](../../../scenarios/ui.md#webview-isolation)验证。

## 复现与未覆盖范围

将本目录复制到新的 `.local` 子目录，在 candidates 内用 `pnpm install --ignore-workspace --ignore-scripts --frozen-lockfile` 安装固定候选。所有运行从仓库根发起，避免把缓存、Electron profile 和新结果写回历史证据。

日期脚本和虚拟化运行器使用仓库 apps/desktop 解析到的 Electron。通过 Node child_process 启动，设置 windowsHide: true。日期脚本从该应用解析已可用于 Electron 的 better-sqlite3；不在系统 Node 中加载它。先运行 candidates/build.mjs，再以 virtual-electron.cjs 启动已构建的隔离页面；rpc-probe.mjs 则直接使用系统 Node 与实际 MessageChannel。

Webview 的四个脚本放在同一隔离目录，以同一 Electron 启动 webview-electron.cjs。普通运行生成 webview-results.json；增加 --broad-resource-policy 重现 Worker 越权反例，生成独立结果且预期退出码为 1。两种运行只改变资源 CSP 的来源范围，不访问真实外部服务。

本轮仅在当前 Windows 设备执行，没有新的正式应用、原生制品、其他平台或 CI 运行。根 package.json、pnpm-lock.yaml 与 pnpm-workspace.yaml 的前后 SHA-256 一致。完整数据库与恢复实现的交付检查仍由相应工作包承担，四个独立项目的范围不因本轮工具选择改变。
