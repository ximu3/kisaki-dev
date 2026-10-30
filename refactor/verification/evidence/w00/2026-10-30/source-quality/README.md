# 源码概述、配置说明与工程寿命

2026-10-30，以 `997ac3508950acefbcc777ee59d82b725bbc5cb6` 为审查基线。环境为 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3 与 Electron 45.0.0。依赖版本、公开接口和产品交付范围保持原样。

## 规范与配置

[注释规范](../../../../../../CONVENTIONS.md#file-module-comments)按文件职责区分源码概述与配置说明。业务、库、脚本、测试、自有声明和模板源码继续保留简短概述；配置不因使用 TypeScript 而增加统一文件头要求，重要取值和环境约束就近说明。

118 份配置移除了重复用途的文件头，其中 TypeScript 配置 105 份，YAML、TOML 与工具专用文本配置 13 份。TypeScript 比较移除注释后的编译输出，YAML 比较解析结果，其他格式比较去除概述后的正文，结果均相同。143 份自维护 TypeScript／Rust 源码仍有文件概述；生成声明与历史证据保持来源边界。逐项结果见 [configuration-check.json](configuration-check.json)。

保留了 preload 沙箱、AppImage 启动、缓存预算和证据原始字节等实际约束说明。renderer 开发 CSP 和 UI 的 Solid 运行时共享理由放在相关配置旁。共享 ESLint 源码模块的职责说明继续保留。

[Google TypeScript 指南](https://google.github.io/styleguide/tsguide.html#fileoverview)将文件概述作为可选项；本项目对自维护源码保留统一概述，以说明跨运行环境的职责。配置说明按实际信息需要维护，与[注释提供额外信息的原则](https://google.github.io/styleguide/tsguide.html#make-comments-that-actually-add-information)一致。

## 审查问题的处理

| 拥有者 | 实现与对应行为 |
| --- | --- |
| 原生窗口 | ready 与 close 使用 `webContents.ipc`，每个窗口独立登记并保留主 frame 判断。窗口构造后的装配与加载共同受失败清理保护。 |
| 应用装配 | 第二实例激活处理器在启动窗口关闭时解除，不再持有已经关闭的窗口。 |
| lint 修复入口 | 根 `lint:fix` 通过原有 Turbo 依赖图准备声明，再执行 ESLint 修复；整个修复运行不读取或写入任务缓存。 |
| 输出交接 | 准备、采用、回退和候选清理的失败通过原生错误与 AggregateError 交付；回退或清理再失败时保留两项原因。 |
| 进程退出验收 | 只有 ESRCH 被判作进程不存在；其他系统查询错误使验收失败。 |
| Hooks 安装器 | 从项目根的 Git 元数据区分源码归档与仓库，Git 执行失败不再被解释成归档；配置读取区分缺省值与错误，并保留原生命令诊断。 |
| 开发会话接口 | 说明句柄返回、首次 ready、closed 与当前运行代际的区别，以及清理失败和未确认读取者对应的输出保留。 |

窗口作用域依据 [Electron 的公开 IPC 接口](https://www.electronjs.org/docs/latest/api/web-contents#contentsipc)，并核对了锁定版本的声明与实现。修复入口采用 [Turbo 原生 cache 选项](https://turborepo.dev/docs/reference/run#--cache-options)，没有增加任务调度器、重试或恢复框架。

新增一项实际 Electron 双窗口回归：通过当前窗口工厂创建阅读窗口，消费已准备的 renderer 和 preload，等待启动窗口的原生 `closed` 事件，触发第二实例事件，再通过阅读窗口自身的 UI 正常关闭应用。它验证窗口登记与寿命，第二实例事件由测试直接触发；既有四类窗口入口测试继续验证真实应用启动、隔离和关闭。

## 本机验证

| 检查 | 结果 |
| --- | --- |
| 类型 | 全仓 50 项任务通过；最终测试类型调整后，桌面项目复验通过。 |
| lint、边界与格式 | 全仓 54 项 lint／依赖任务及 Prettier 检查通过；最终桌面测试修改后，所属 lint 复验通过。 |
| 普通 Node 测试 | 共 54 项通过。根套件初次有一项超时，单独复验 27 项通过；其他工程的 27 项保持已通过结果。 |
| 干净副本 lint:fix | 八个公共包的 dist 均不存在时启动，50 项任务通过，缓存命中为 0，源码没有产生修改。见 [lint-fix-verification.json](lint-fix-verification.json)。 |
| 实际 Electron 窗口 | 四类窗口入口与双窗口回归共 5 项通过。 |
| 开发会话 | 正常／取消退出、失败重建、代际交接、公共包恢复、renderer 更新和初次准备取消共 4 项通过。 |
| 启动与退出采样 | 20 次实际启动通过，观察到的进程均正常退出；启动 p95 为 581.13 ms，中位数为 516.67 ms。 |

运行构建标识为 `c56e3af0f1ea78b2`。最后的测试类型标注与说明调整不改变运行行为。配置等价核对、检查命令与结果见 [verification.json](verification.json)，原始日志和诊断保存在 [logs.zip](logs.zip)。

本机没有额外重复公共包仓库外消费、原生文件接口或完整载体验收；这些入口由下述实际 CI 覆盖。未执行正式签署、npm 发行或服务部署。

<a id="ci"></a>

## 六目标 CI

源码提交 `557d30cbfefbd3d93802c4708c688f24ef8aed10` 的[完整 CI](https://github.com/ximu3/kisaki-dev/actions/runs/41032668672)通过，用时 18 分 24 秒。Windows、macOS、Linux 的 x64／arm64 六个目标、仓库检查及 `verify / Required checks` 均成功；[PR 标题检查](https://github.com/ximu3/kisaki-dev/actions/runs/41032706150)独立通过。

六目标实际执行所选原生、窗口、启动采样、开发流程和候选制品检查；Linux x64 同时完成八包仓库外消费与浏览器验证。逐任务与步骤结果保存在 [ci.json](ci.json)。结果限于工程与当前实现范围，正式签署、产品功能与后续工作包仍按各自状态记录。

<a id="observations"></a>

## 运行观察

- 隔离副本第一次安装依赖在包链接完成后以 Windows `0xC0000005` 退出。同一副本再次执行相同 frozen/offline 安装成功，随后完整 lint:fix 通过；这次工具异常没有归因到源码改动。
- 根任务图用例在同机另一个副本执行 lint 时超过 30 秒。单独复验整个根套件用时 28.95 秒并通过；保留初次失败，没有调整测试预算或减少断言。
- 第一次桌面构建在候选目录改名到正式输出时得到 EPERM，候选清理完成，失败后正式目录没有可用制品。这次记录不能证明恢复过旧制品。后续带既有只读占用诊断的完整构建通过，没有捕获到自然 EPERM；仅记录了原生工具临时文件的 ENOENT，占用者仍未确定。既有受控占用证据继续按[原范围](../../2026-10-29/closure/README.md#output)解释。
- 双窗口测试准备阶段修正了 debugger evaluate 不支持动态 import、页面关闭早于原生窗口关闭，以及应用关闭后进程句柄的取得时机。最终用例等待对应资源的真实完成，不为这些测试接入问题增加产品防御。

审查中替换自有宿主、令其发送任意值的探针没有建立实际支持场景，不据此扩大私有生命周期协议或新增异常组合测试。现有错误分类问题直接在拥有层处理，验证覆盖实际行为与回归。
