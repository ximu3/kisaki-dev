# W00 工程全覆盖复核

本轮核对当前工程的 187 份源码、121 份配置、2 份锁文件、1 份绑定生成声明及 123 个目录。逐文件归属和摘要见 [inventory.json](inventory.json)。范围包含运行代码、Rust／Node 接入、工具、测试、模板、八包及 33 个扩展的工程配置；同构文件逐项核对身份和差异。历史验证材料与第三方内容按原归属保留。

## 调整结果

- [逻辑分段](../../../../../design/engineering/conventions.md#logical-sections)明确输入与守卫、准备、执行、交接、返回和清理的组织方式，并覆盖测试、数据、CSS 和配置；[目录规则](../../../../../design/engineering/conventions.md#directory-readability)按职责和工程边界判断层级。
- 保留四个独立窗口入口、八包、33 个扩展以及 packaging、registry 等 W00 骨架。共同窗口视图集中维护，能力由入口注入；日志、路径、平台目标和可执行程序定位使用与实际职责相符的位置与名称。
- 运行清单与载体身份有唯一纯合同；构建身份、Vite 管理、进程生命周期、候选生成、字体准备和制品解包各归相应拥有者。移除了无消费者的导出及重复的内部解析。
- 默认主题值与发布 CSS 改为同源生成，仓库外消费者验证明暗主题与全部 token 的存在；测试比较浏览器解析后的颜色，允许普通 CSS 优化器改写等价语法。
- 普通测试发现与类型检查覆盖一致；生成缓存按所有工程的位置排除，当前维护的测试与工具仍纳入检查。补充真实便携目录和固定字体输入的正常／失败用例。
- 独立 ffprobe 的源码、配置、下载、构建及 CI 归档流程已移除，当前桌面制品不含 ffprobe。媒体信息读取的原生路线另有[实际验证](../../../media-information/2026-10-24/results.json)。

`packaging` 是 electron-builder 的静态打包输入边界，当前只有归属说明；执行逻辑在 `tools/package`，最终产物在 `dist`。目录内容少不表示它不属于 W00，也不表示 W11 的平台专用输入和发行能力已经完成。

## 验证

当前 Windows x64 构建标识为 `d1e675e5e1b5998a59d68e6c1876e5e97050b46da54eadf89cd60a991560da9c`，已与本次源码身份核对相同。制品输入见 [desktop-build.json](desktop-build.json) 和 [artifacts.json](artifacts.json)。

| 检查 | 结果与证据 |
| --- | --- |
| 类型、lint、依赖边界、格式、常规测试 | 通过；47 项类型任务及根检查，161 模块／284 依赖，25 项常规用例。[check.log](check.log) |
| 八份 tarball 与仓库外消费 | publint、ATTW、严格类型和实际 Node／浏览器消费通过。[package-checks.log](package-checks.log)、[consumer-tests.json](consumer-tests.json) |
| Electron 原生／SQLite | 8 项通过。[native.log](native.log) |
| 真实浏览器组件 | 1 项通过。[browser.log](browser.log) |
| 四类 Electron 窗口 | 4 项通过。[e2e.json](e2e.json) |
| 开发会话 | 失败保留、修复交接、改名、HMR、公共包更新和停止清理通过。[development-test.json](development-test.json) |
| 最终 ZIP | 资源、载体身份、正式 fuses、外部窗口观察、便携资料和正常退出通过。[artifact-test.json](artifact-test.json) |
| 20 次启动与退出 | P95 1,700.28 ms，中位数 736.65 ms，最大值 6,428.89 ms；按预先固定的 P95 ≤ 5,000 ms 预算通过，保留全部样本。[performance.json](performance.json) |

性能范围仍是 W00 外壳、热磁盘缓存与隔离资料目录，不是完整业务性能或最大启动时延保证。NSIS 已生成，安装、更新和卸载未在本轮验收。其他五目标与远端 CI 仍待完成，W00 继续保持进行中。

旧 ffprobe 的源码快照与已核验 r3 归档留在忽略的 `artifacts/retired`，不再作为当前构建输入。新工程未提交、推送或发布。
