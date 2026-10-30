# 编码规范与类型感知检查

2026-10-30，以 660e51a3403eb51af03cfcafeae07b98aa49ed78 为基线核对并落实规范。环境为 Windows x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、ESLint 10.13.0 与 typescript-eslint 8.72.0，依赖版本和锁文件保持原样。

## 规范与实现范围

根目录 [CONVENTIONS.md](../../../../../CONVENTIONS.md) 拥有完整编码规范；设计目录保留设计充分性与实施判断，协作入口引用所属规则。源码、脚本、测试、模板和代码配置保留简短文件概述，声明式配置按用途、继承、环境与关键取值说明。33 个扩展及相关工程 README 移除重复用途清单，仍保留身份、使用方式、合同和状态入口。

TypeScript 控制流统一使用代码块；具名操作、回调、类型推断、分段和抽象按实际语义判断。并发映射明确等待对象，等待方式与失败清理相符。接口文档交代完成、失败、重复调用和资源责任，实现注释说明非直观原因。

共享 ESLint 基线通过 TypeScript Project Service 使用既有 tsconfig 与 references，增加 Promise 使用、判别联合穷尽性及不安全动态值流动检查。没有增加依赖、lint 专用类型项目或源码别名。受控清单、生成结果和运行时加载入口明确使用原有类型合同；这类类型表达不代替外部输入的运行校验，也不代表发现了对应的运行时漏洞。

消费者样板在原仓库只进行语法检查，完整规则在仓库外安装八包 tarball 后运行，使用相同共享基线及消费者自身类型项目。原有无框架页面、Solid 页面、声明和 Node 消费继续验证。

## lint 的输入与构建范围

全仓 lint 在基线中已经因依赖边界检查准备八个公共包。本次将声明准备列为项目 lint 的 ^build 前置，前后的实际构建集合相同，不包含桌面应用、Rust 原生模块或打包。见 [构建范围](lint-build-scope.json)。

真实 Turbo 输入核对在隔离 Git 目录中使用当前清单和配置：共享 TypeScript 基线变化使 45 项 lint 失效，根类型配置只使 root:lint 失效，应用类型配置只使桌面 lint 失效。见 [缓存输入](lint-cache-inputs.json)。已有任务选择用例同时核对未改变的声明构建只作为前置，不扩大桌面运行验收范围。

同一份已准备声明的源码，分别在新进程中关闭 ESLint 缓存，进行一次语法检查与一次完整类型感知检查：均检查 245 份文件、零错误与警告，耗时分别为 2.75 秒和 23.34 秒。实际全仓 pnpm lint 用时 35.78 秒，54 项任务通过，其中 5 项构建命中缓存。该对照用于观察新增分析成本，不作为统计性能结论，见 [验证摘要](verification.json)。

## 验证结果

| 范围 | 结果 |
| --- | --- |
| 类型与格式 | 全仓 50 项类型任务通过，Prettier 检查通过。 |
| lint 与依赖边界 | 全仓 lint 通过；类型感知规则能沿导入拒绝未处理的 Promise，并接受正确等待；263 个模块、568 条依赖通过边界检查。 |
| 普通 Node 测试 | 54 项通过。根套件修正声明构建前置的预期后，27 项复验通过；其他项目的 27 项保持已通过结果。 |
| 公共包消费 | 八包构建、打包、publint 与 ATTW 通过；仓库外完整 lint、严格声明、Node、无框架页面及 Solid 页面两项集成用例通过。 |
| 文档引用 | 现行文档的本地目标与锚点核对通过；历史说明仅更新规范链接，原始试件、运行结果和摘要保持。 |
| 源码审阅 | 64 份 TypeScript 差异按职责审阅。57 份在移除类型、注释并归一化等价控制块后输出相同；其余为 lint 配置及测试检查，逐项说明见 [输出比较](emission-comparison.json)。 |

普通测试初次运行时，原任务选择断言只允许 lint 本身，未包含新声明前置；实际图只新增对应的 desktop-contracts 构建，并未选中桌面运行套件。断言现明确校验所需前置及其未改变状态，原有运行范围断言保持。

本机没有重跑真实 Electron、原生、性能或六目标验收。本次运行与构建实现保持同义，既有记录仍按原输入、环境和结果解释；类型感知检查的本机结果不代替其他平台的执行证据。

原始命令日志、诊断、输入核对与单次耗时保存在忽略目录 artifacts/readability-conventions/2026-10-30。当前交付状态由[状态页](../../../../implementation/status.md)维护。

## 判断依据

- [Google 代码审阅](https://google.github.io/eng-practices/review/reviewer/looking-for.html)区分设计、复杂度、注释内容与风格，支持按完整理解路径审阅；[TypeScript 风格指南](https://google.github.io/styleguide/tsguide.html#fileoverview)将文件概述作为可选项。本项目保留全部自维护源码的简短概述，以满足跨运行环境的定位需要，声明式配置按其表达方式说明。
- [Prettier 的工具分工](https://prettier.io/docs/integrating-with-linters)把格式与代码质量检查分开；[空行说明](https://prettier.io/docs/rationale#empty-lines)说明逻辑分段仍需作者判断。
- [类型感知 lint](https://typescript-eslint.io/getting-started/typed-linting/)提供原生 Project Service 接入；[配置说明](https://typescript-eslint.io/users/configs/)区分推荐、严格及风格规则。本项目选择与实际异步和类型风险对应的规则，没有直接启用全部规则。[void 的说明](https://typescript-eslint.io/rules/no-floating-promises/#ignorevoid)用于明确忽略等待与处理拒绝的区别。
- [Rust API 文档](https://rust-lang.github.io/api-guidelines/documentation.html)与 [Solid splitProps](https://docs.solidjs.com/reference/reactive-utilities/split-props)分别提供语言文档与响应式语义的依据，共同原则不要求不同生态采用同一语法。
