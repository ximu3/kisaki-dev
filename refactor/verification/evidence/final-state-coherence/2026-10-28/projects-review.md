# 独立技术项目终态与一致性审查

审查基线：`ad9113d0c9eb0d83ee32e876a2aa8cab35fdbffe`。覆盖 `refactor/design/projects/` 全部 30 篇文档、OAuth 两份 JSON，以及 libmpv 两份 patch 和 manifest，共 35 项。直接修改限定于项目文档，共 24 篇；公开字段、默认值、格式范围、颜色/呈现算法、原生协议、OAuth JSON 和 patch 均未改动；manifest 的摘要纠错由主代理完成。独立项目正式实现与全部后端运行没有在本轮发生。

## 结论与实际修改

项目合同的主要拥有关系成立：Vantage 持有外部实例与平台操作，Kana 持有源解释及阅读流程，libmpv-node 持有绑定/原生资源，oauth-relay 持有短期授权交接。当前较多正文用“本次重写”“原型已经验证”“现已补齐”“旧范围移除”叙述成果；已改为当前职责、能力与完成条件，保留必要机制来源，进度引用实施状态。真实的临时资源、短期会话、回调阶段、旧 KWin 版本差异、失败及权限边界均保留。

确认并协同修正一项确定的源码准备问题 PA-01。两项上游修改本身有当前职责依据，并非症状处的平行补救。未发现应当通过删能力、删平台、改变默认值或缩小验收来消除的合同冲突。

## PA-01：截图补丁的 afterSha256 混用了 CRLF

位置：`refactor/implementation/patches/libmpv/manifest.json:27`，关联 `libmpv-node/distribution.md#构建与升级` 和 `native-runtime.md#delivery`。

固定上游提交的 `player/screenshot.c` 为 LF，原始摘要与 beforeSha256 完全匹配。用原 patch 执行 `git apply --check` 和 `git apply` 后，得到 `0f8bc0f02942f953f9148f934367747698b2bae153113843d0ddf9ed29f54e13`；清单却记录 `6d5bbe353c97f114c6eee305495e676b83c330cd6a1b44f464018b541ded8ccf`。将同一结果仅转换为 CRLF 后，才得到清单值。黑色映射补丁的 before/after 均按 LF 正确匹配。

固定上游递归树没有 `.gitattributes`，`.editorconfig` 也没有 end_of_line 指定。现行文档要求精确源码字节和前后摘要，没有定义平台换行例外。因此正常原始字节准备会被现清单拒绝。这是清单/来源准备一致性错误，不是颜色或截图算法变化。

建议：按固定提交 blob 字节准备源码，关闭该工作副本的 checkout 换行转换或采用等效原始字节导出；补丁应用前后均按实际字节形成唯一摘要。修正现行 manifest 的 LF afterSha256，并在准备流程说明中明确这项统一口径。不要新增“Windows 接受 CRLF，其他平台接受 LF”的平行合同，也不要改变历史 CRLF 运行收据。主代理已将 manifest 改为唯一 LF 摘要；本子任务同步明确 Git blob 原始字节与检出换行规则。复核两项 patch 的全部摘要和精确应用均通过，历史 CRLF 实测收据保持原样。

可复现材料：`projects-patch-check.py`、修正前 `projects-patch-integrity-before.json` 与修正后 `projects-patch-integrity.json`，原始/应用后输入位于 `upstream-patch-review/`。执行 `python .local/final-state-audit/projects-patch-check.py`。该检查只核对固定来源和源码变换，不编译或运行原生代码。

## 两项上游修改的长期责任

| 修改 | 当前能力为什么需要 | 共同拥有层与维护责任 | 替代路线及代价 |
| --- | --- | --- | --- |
| black-tone-map | 固定源码的 pass_color_map 在源峰值大于目标峰值时进入 pass_tone_map；HDR 片源到 sRGB/Display P3 SDR 仍属该路径。sig_orig 为零时发生的除法不能交给宿主猜测像素是否正常。 | libmpv-node 在固定媒体组合中维护原生计算修复、源码摘要、上游升级与回归。非零路径保留原运算；正常输入、近黑及半透明合成仍分别检查。 | 等效上游修复经回归后取代本地修改是既定退出条件。改渲染器需要额外嵌入接口和跨平台资源工作；拒绝 HDR 输入会削弱合同；在宿主替换 NaN 像素丢失合成贡献且未闭合根因。 |
| screenshot-source | 上游 screenshot-raw 可以在 VO 无图时自动转软件；screenshot-sw=false 不能证明该次结果来自 VO。结果本身没有可供可靠核对的来源字段。 | player/screenshot.c 在同一次取图时记录 use_sw 并随 map 交付来源；binding 保留值，宿主结合受管 GPU/sRGB 条件决定采用。无图仍失败，source 不是颜色证明。 | 等效逐结果上游信息通过回归后移除。GPU 纹理读回需要重新确定截图尺寸、字幕/缩放语义、读回与独立字节寿命；仅靠事后属性/选项推断仍不能识别回退。新增无回退选项同样形成需维护的上游合同。 |

一手来源：[固定共用映射](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/gpu/video_shaders.c#L880)、[固定截图分支](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/player/screenshot.c)、[上游 D3D11 接入](https://github.com/mpv-player/mpv/commit/4255130de410e0cbdab694b951085409d466b704)。选择保留两项修改依据当前需求与具体责任，不把“上游尚未合入”等同于无需维护，也不因文件名是 patch 否定实现。

已有证据只按其原始范围复用：`libmpv-upstream-fix/verification.md` 的 49 场景/98 帧是 Windows D3D11、RGBA16F、低峰值线性相关对照；它不是当前两个 SDR 目标的完整验收。`contract-closure/2026-10-22/README.md#screenshot` 的五场景覆盖正常 sRGB/P3/HDR→SDR、显式软件与强制 VO 回退，未新验收无图整体失败、负 stride、持续采集、macOS/Linux 或完整正式绑定。本轮没有重新执行这些原生实验。

## 保留的重要设计边界

- Vantage：macOS 窄范围窗口映射、GNOME/KWin 组件、旧 KWin 实际可执行路径登记均对应已选能力与版本限制。AppImage 别名和 NoDisplay 条目是显式系统集成拥有的运行资源；不得因“临时目录”字样删除，也不把 KWin 6.8 的差异推广到旧版。
- Kana：RAR/CBR 直接支持范围、Firefox 作者 CSS 强制断页差异、完整章节投影、跨文档源选区、Service Worker 授权和资源寿命均保留。源解释及正常阅读能力没有因文档整理减弱。parse5 固定内部接缝、libiconv 六项 CP932 差异具有明确的源映射/编码责任与升级条件，不能伪装成公开 API 或无维护成本。
- libmpv-node：SDR 目标与 HDR 输入分开；软件/GPU 选择、独立帧、调用取消、hook/流源关闭及进程运行库分别按资源所有权处理。头文件与实际 targetTime 单位的差异作为固定版本必要依据保留。
- oauth-relay：本地 S256 与上游绑定能力分开，Bangumi/AniList 的既定支持未改变。单实例、原始上游 code、一次领取、结果未知不重放和无持久 token 库保持。Node 24.22.0 的 `server.close` 只先关闭已有空闲连接，后续响应进入 keep-alive 的收尾仍有固定源码依据；没有为整齐删除这项真实生命周期处理。[Node 固定实现](https://github.com/nodejs/node/blob/v24.22.0/lib/_http_server.js)

## 跨拥有者交接与验证缺口

1. PA-01 已由主代理修正 manifest，本子任务同步统一源码准备口径；两项修改复核通过，历史证据原文保持。
2. 本体 `domains/sessions`/anime 承诺记住音量与静音时，偏好拥有者应定义持久字段、默认和值域。libmpv-node/lifecycle.md 的 volume=80 是调用示例，createMpv 默认沿上游且明确不加载 Kisaki 偏好，不能从例子推导应用默认。本子任务未新增偏好模型。
3. 删除正文中的原型经过不表示关闭待验收项。Vantage 六目标及正式宿主权限身份；Kana 正式发行资产、完整格式/真实出版物、输入/辅助技术；libmpv 当前 SDR、完整绑定及六目标依赖/宿主资源；oauth-relay 双架构镜像和真实部署均继续按既定状态与验收闭合。未因本轮文案改写标记为通过。

## 本轮检查

- 30 篇逐篇通读；35 项逐项结论见下表及 `projects-coverage.json`。
- `git diff --check -- refactor/design/projects` 通过。
- 282 个本地 Markdown 链接目标存在；代码围栏忽略一条说明注释后与基线相同，见 `projects-doc-checks.json`。
- 使用工作区已有 Ajv 8.20.0 的 Draft 2020-12、strict 模式编译 schema，config.example.json 校验通过；scope 字符表达式与 RFC 字符范围逐字符一致。没有改 JSON，也没有把结构检查当成启动环境/上游验证。最初尝试系统 Python jsonschema 发现未安装，未安装新依赖，改用工作区现有 Ajv 完成检查。
- 两 patch 的原始补丁摘要、原始源码摘要与精确 hunk 应用通过；black-tone-map 修改后摘要通过；screenshot-source 的修改后摘要差异已按 PA-01 修正，修正前后静态收据均保留。
- 未运行全仓格式、长测试、真实后端/桌面、原生构建或发布；未创建独立项目源码、commit、push 或 PR。

## 逐项覆盖

| 文件 | 结论 | 审阅依据与处理 |
| --- | --- | --- |
| `refactor/design/projects/README.md` | 修改 | 统一引用终态与整体一致性；独立仓库生命周期回归仓库规范，保留四项目的长期产品定位和联合交付。 |
| `refactor/design/projects/native-runtime.md` | 修改 | 核对 core/binding、Node 环境、运行库与帧资源；将修复和来源标记写为 libmpv-node 的维护责任。 |
| `refactor/design/projects/vantage/README.md` | 保留 | 进程、窗口、前台、观察和平台模块拥有者清楚；Linux 组件归独立项目交付，无临时源码或业务模型混入。 |
| `refactor/design/projects/vantage/api.md` | 修改 | 核对实例引用、字段不可用、查询/观察、控制完成、取消、授权身份和截图；清除本次重写及当前主机的进度叙述。 |
| `refactor/design/projects/vantage/backends.md` | 修改 | 保留六目标、原生身份并发边界和权限/颜色/采集路线；将 WGC 迁移叙述改为接口事实与验证范围。 |
| `refactor/design/projects/vantage/linux.md` | 修改 | 核对 D-Bus sender、组件代际、PipeWire/QImage、XRes、KWin 版本登记；把蓝本推进叙述改为当前协议职责。 |
| `refactor/design/projects/kana/README.md` | 修改 | 保留单包、纯合同入口和滚动桌面浏览器窗口；将整体一致性纳入技术取舍原则。 |
| `refactor/design/projects/kana/api.md` | 保留 | 完整核对 ByteSource/MemberSource 持有、settings/fonts、状态、观察、导航、临时查看、关闭及错误；未发现需要改动的合同冲突。 |
| `refactor/design/projects/kana/settings.md` | 保留 | 核对完整字段、库默认、单位、范围与宿主独立偏好；单/双面、方向、字体和颜色不缩减。 |
| `refactor/design/projects/kana/formats.md` | 修改 | 核对全部格式、URL 稳定输入、XML 编码/实体、CFI、MOBI/KF8、页序及索引；RAR 边界改为当前支持与实际成本依据。 |
| `refactor/design/projects/kana/positions.md` | 修改 | 保留格式源地址、源树、几何、正文/辅助路径及 href 选择；将实验次数移回证据，保留机制来源与完整格式验收。 |
| `refactor/design/projects/kana/content.md` | 修改 | 核对原文、Unicode 匹配、ruby、几何和 readView 资源；去掉浏览器试验经过、局部误差数字和未来优化叙述。 |
| `refactor/design/projects/kana/layout.md` | 修改 | 保留完整章节投影、明确面数、换轴、原生 CSS 分页范围及辅助语义；将补证/缩减叙述改为当前验收边界。 |
| `refactor/design/projects/kana/styles.md` | 修改 | 核对字号/字体/配色/伪元素、作者原值、CSS 语法和覆盖次序；保留私用字形的既定元素边界并直接解释代价。 |
| `refactor/design/projects/kana/interaction.md` | 修改 | 核对跨文档选择、触摸/键盘、语义副本、焦点、辅助技术和剪贴板；只改示例中的过程性注释，接口不变。 |
| `refactor/design/projects/kana/resources.md` | 修改 | 核对授权字节、Service Worker、CSP、传输背压、预算、取消和退役；将四环境/停 worker 实测叙述改为当前责任与依据。 |
| `refactor/design/projects/kana/distribution.md` | 修改 | 核对 ESM/资产闭包、同源部署、ZIP/PDF worker 与 font 资源；移除局部试件通过的进度叙述，保留制品验收责任。 |
| `refactor/design/projects/libmpv-node/README.md` | 保留 | client/video/runtime 与帧独立寿命归属一致；软件字节和 GPU 持有分开，Electron 接入归本体。 |
| `refactor/design/projects/libmpv-node/api.md` | 修改 | 核对完整控制、错误、取消、客户端/hook 和目录；将补齐/已检查等过程说明改为当前接口与语义定义来源。 |
| `refactor/design/projects/libmpv-node/values.md` | 修改 | 保留 bigint、字节、MpvNode、格式选择和转换失败快照；清除已确认扩展的过程用语。 |
| `refactor/design/projects/libmpv-node/notifications.md` | 修改 | 核对 Observer、创建/停止、初始状态、事件/日志缺口和文本失败；明确当前错误职责和早期日志归属。 |
| `refactor/design/projects/libmpv-node/lifecycle.md` | 修改 | 核对初始化、脚本、日志、取消、常驻运行库、ref/unref、队列和关闭；用正式次序替代原型经过。 |
| `refactor/design/projects/libmpv-node/streams.md` | 保留 | 协议登记、字节源交接、open 取消限制、同核心重入与关闭等待均有真实原生/资源依据，无须伪装成普通订阅。 |
| `refactor/design/projects/libmpv-node/video.md` | 修改 | 保留 SDR 双目标、HDR 输入、GPU/软件选择、设备、帧池和时序；删占位形状、旧 HDR/原型选卡等叙述。 |
| `refactor/design/projects/libmpv-node/platforms.md` | 修改 | 保留 D3D11/CGL/EGL、各平台共享资源与同步；用固定接口责任替代合入经过和未在某主机执行的状态。 |
| `refactor/design/projects/libmpv-node/distribution.md` | 修改 | 明确固定上游修改的共同层职责与维护；保留当前 SDR 验收边界；源码摘要口径问题交主代理处理。 |
| `refactor/design/projects/oauth-relay/README.md` | 保留 | 单实例、配置/provider/session 事实边界和独立源码职责自洽，令牌不进入长期服务状态。 |
| `refactor/design/projects/oauth-relay/protocol.md` | 修改 | 核对端点、参数、状态、一次领取、错误、配置和容量；将既有三端点改为公共协议表述，保持原始上游 code 与 S256 边界。 |
| `refactor/design/projects/oauth-relay/providers.md` | 修改 | 保留 Bangumi/AniList 刷新、Google 接入与附加操作、固定端点和真实 PKCE 差异；删除迁移和试件操作经过。 |
| `refactor/design/projects/oauth-relay/deployment.md` | 修改 | 核对固定双架构镜像、Compose 输入、秘密、健康和关闭；保留 Node 原生 keep-alive 收尾依据，移除发布进度叙述。 |
| `refactor/design/projects/oauth-relay/config.example.json` | 保留 | 无秘密示例与正文默认值、provider 字段、IPv4/IPv6 回环规则一致；通过 Ajv 8.20.0 的 2020-12 严格结构校验。 |
| `refactor/design/projects/oauth-relay/config.schema.json` | 保留 | 核对字段白名单、required、google 分支、uniqueItems、整数/秒范围和 scope 字符范围；跨字段/URL/环境检查明确归启动语义校验。 |
| `refactor/implementation/patches/libmpv/black-tone-map.patch` | 保留 | 共用 pass_tone_map 的零分母根因修复；前后源码和补丁摘要全部匹配。现行 HDR→SDR 仍调用该路径，旧线性像素证据不等于当前 SDR 全验收。 |
| `refactor/implementation/patches/libmpv/screenshot-source.patch` | 保留 | 在实际取图拥有层随结果交付 vo/software，完整保留原有取图和回退语义；补丁字节和基线匹配，修改后摘要记录存在换行口径差异，见 PA-01。 |
| `refactor/implementation/patches/libmpv/manifest.json` | 主代理已修正 | PA-01 已统一为固定上游 blob 与实际 git apply 的 LF 摘要，复核通过；历史 CRLF 实测收据不改写。 |
