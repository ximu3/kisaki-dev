# 日期、虚拟化与 Webview 验证

本目录记录[日期](../../../../design/domains/values.md#years)、[虚拟化](../../../../design/ui/virtualization.md)和[Webview 隔离](../../../../design/extensions/webview.md#isolation)的技术验证，结果适用于所列版本、输入与环境。

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

实际结果支持保留现有合同，没有发现必须通过收窄字段来解决的核心运算问题。它不证明全部来源映射、实际四语表单、时区日界或完整日期 UI 已完成；这些仍按正式实现验收。158,400 个输入是一个公历周期的规则对照量，不是同等数量的产品场景。

<a id="virtualization"></a>

## 虚拟化：采用现有几何实现

[TanStack Solid 适配](https://tanstack.com/virtual/latest/docs/framework/solid/solid-virtual)提供框架接入，[Virtualizer 公共 API](https://tanstack.com/virtual/latest/docs/api/virtualizer)提供数量、尺寸测量、稳定 key、范围提取和滚动能力。使用 @tanstack/solid-virtual 3.13.48、@tanstack/virtual-core 3.19.6、Solid 1.9.16、Vite 8.3.3 和 vite-plugin-solid 2.11.14，实际构建后在 Electron 41.2.0／Chromium 146 中运行。

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

测试用 [virtual-probe.jsx](virtualization/virtual-probe.jsx) 和[运行器](virtual-electron.cjs)，结果见[原始 JSON](virtual-results.json)。试件通过 Electron offscreen 页面运行。运行时关闭硬件加速，没有测量真实显示器上的 FPS、输入延迟或 GPU 性能。

实际视图使用这项几何依赖，普通业务数据保留可见与预取区间。正式卡片、图片、字体、快速滚动、拖拽、读屏、跨窗口数据与查询并发仍需验证。几何通过不等于完整列表已通过验收。

<a id="webview"></a>

## Webview：实际来源与 Worker 的资源限制

第三方页面按浏览器规则请求 HTTPS／WSS 数据；页面和脚本由扩展包提供，外部网站通过明确动作在系统浏览器打开。官方扩展的业务请求、账号和凭据继续在 Node。接入合同包含每视图独立来源、原生 preload 与 SDK 的边界、完整 CSP、导航和权限拒绝，以及开发环境的有限例外。

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

将本目录复制到新的 `.local` 子目录，在 virtualization 内用 `pnpm install --ignore-workspace --ignore-scripts --frozen-lockfile` 安装固定依赖。所有运行从仓库根发起，避免把缓存、Electron profile 和新结果写入维护目录。

使用记录所指的 Electron 和匹配的 SQLite 绑定运行试件。KISAKI_PROBE_APP_PACKAGE 指向隔离依赖项目的绝对 package.json 路径，日期脚本据此加载 better-sqlite3。通过 child_process 启动所选 Electron，设置 windowsHide: true。虚拟化先执行 virtualization/build.mjs，再以 virtual-electron.cjs 运行已构建页面。

Webview 的四个脚本放在同一隔离目录，以同一 Electron 启动 webview-electron.cjs。普通运行生成 webview-results.json；增加 --broad-resource-policy 重现 Worker 越权反例，生成独立结果且预期退出码为 1。两种运行只改变资源 CSP 的来源范围，不访问真实外部服务。

本页运行环境为所列 Windows 设备。完整数据库、恢复实现及平台组合按相应工作包验收。
