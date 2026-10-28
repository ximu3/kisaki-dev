# 构建读取边界与首轮 CI 复核

本记录接续最初集成提交 `2cc6a63dccb83a92b3fe600f849bf8c8cbe456fd`，保存独立终审发现、追加修正与首轮远端结果。当前 PR 为 [#9](https://github.com/ximu3/kisaki-dev/pull/9)，各输入的远端状态由该 PR 对应的检查维护。

## 构建输入的读取时序

coordinator 在首次输入身份之前读取 package.json，会把清单变化窗口排除在首尾核对之外：读到旧版本后，清单修改，首尾两次摘要均属于新输入，输出仍可能带旧版本、名称或 Electron 版本。现将清单读取放到首次摘要之后的候选准备回调中，保持所有本次元数据读取都受首尾检查覆盖。

同类核对还发现 preload 的入口表在 programs 模块初始化时被静态导入。开发会话监听到 Vite 配置变化后，入口表仍可能保留旧值。现在由每次 buildProgram 调用 Vite 的公开 loadConfigFromFile 取得命名入口，配置文件继续唯一拥有这张表；每个入口仍单独生成完整 CommonJS，首项清空候选、后续项追加，实际模块仍由编译器输出收集。

新增 [preload 回归](../../../../../clients/desktop/app/tests/tools/build/preload.test.ts)在同一个 Node 进程内执行两次真实 Vite 编译：第一次消费原 main 入口，第二次修改配置并消费新入口，同时核对其他三个输出保持各自含义。该用例通过，独立复核确认清单、入口配置与输出交接的边界一致。

## 首轮远端结果与冷准备等待

[运行 40679271566](https://github.com/ximu3/kisaki-dev/actions/runs/40679271566)对应 head `2cc6a63`，实际检出合并预览 `c46e4a7ed04a10178fcb18a0e664dbecefd64534`。仓库、范围选择与五个桌面目标通过；macOS x64 的首次开发会话就绪等待失败，Required checks 按实际结果失败。完整结果保存在 [ci-first-run.json](ci-first-run.json)。

macOS x64 已通过原生／SQLite、四窗口及 20 次启动测量。其开发控制器首个轨迹在 50,575 毫秒进入 building，输出记录首次公共包构建为 34.064 秒、随后 Rust release 编译为 61 秒；120 秒等待到期时没有应用 Starting 或 ready，测试正常取消准备并在 120,245 毫秒报告 stopped。后续相同工作区的首次 ready 为 41.117 秒和 25.515 秒；另一隔离工作区的取消后重试在 65.004 秒 ready。现有轨迹足以将本次失败定位为冷准备占满整体等待预算，不能把它记成应用启动后失去响应。

原始 [macOS 附件](pr9-macos-x64.zip)的 SHA-256 为 `35ce292e7433c6d3c44da290772ab4d00ff570a954304b16edd84058674896ca`，下载后已核验；[控制器记录](pr9-macos-controllers.json)保留全部观测及有界输出。

开发测试对冷公共包、原生准备及首次 ready 的等待统一为 180 秒，在共同测试辅助中定义。应用自己的启动握手仍为 30 秒，整体 test／hook 仍为 240 秒，其他断言、退出、取消、性能、重试次数及 CI 反馈目标保持原值。本次证据只解释这一运行，不据此改写历史其他超时的原因。

## 追加本机验证

| 范围 | 结果 |
| --- | --- |
| 新增 preload 真实编译回归 | 1 项通过，同进程的配置变更实际生效。 |
| `pnpm check` | 类型、lint、格式与 53 项常规测试通过。 |
| 冷准备预算统一后的应用 typecheck／lint | 均通过。 |
| Windows x64 有限构建 | 通过，buildId `89e965d3fa860035`。 |
| 实际开发会话 | 4 项通过，112.16 秒；包含准备取消和完整重试。 |
| 同一构建的 ZIP／NSIS 生成及原样 ZIP | 生成成功；完整摘要、fuses、实际启动和关闭通过。NSIS 没有安装验收。 |

输入、命令、结果与日志见 [validation-followup.json](validation-followup.json)。原有本机与首轮 CI 记录继续对应各自输入，不改写为追加修正后的结果。新提交的六目标复验结果直接对应 PR 中的实际检查。
