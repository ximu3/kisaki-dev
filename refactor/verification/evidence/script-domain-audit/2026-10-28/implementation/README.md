# 脚本范围与工程边界修正

本轮按用户确认采用[审查建议](../README.md)。根定向脚本先标范围，包内脚本先标动作；桌面八包的产物和真实消费者由桌面工作流的 Linux x64 参考目标拥有。

## 已实施

- 根入口改为 desktop:packages:pack、desktop:packages:test:consumers、desktop:packages:test:consumers:prepared，以及 root:typecheck／root:lint／root:test。应用使用 build:native、check:native、prepare:resources；根维护动作使用 install:hooks／uninstall:hooks。
- 包级 publint／ATTW 入口改为 check:package。八包 README 明确使用 pnpm run pack；生成消费者使用 test:node，其默认 tsconfig.json 组织四个真实声明检查环境。
- 桌面包收集归 tools/desktop，消费者、辅助和试件归 tests/desktop，收据与 tarball 归 artifacts/desktop/packages，环境变量为 KISAKI_DESKTOP_PACKAGE_INPUTS。公开 npm 包名和 exports 未改动。
- 桌面消费者选择只接受本组包的 check:package 和准确的根 prepared 任务；其变化只选择 Linux x64。仓库流程保留全仓普通检查，桌面流程组织消费者与实际桌面验收。
- 工程 workflow、共同协调器和标题 workflow 分别处理输入；移除全部 workflow 作为 Turbo 全局依赖的传播。生产构建、构建身份和监听排除测试配置与测试文件，继续发现新生产文件。非类型 lint 只补充实际共用的 ESLint 源码和清单，不再传递所有上游产品源码。
- workspace 登记来自 pnpm，并与维护树中独立发现的 package.json 比较；源码覆盖和依赖扫描不固定顶层工程目录。类型覆盖沿默认 tsconfig.json 及 references，不解析 tsc 命令文本。桌面许可约束与现有三个私有工程包分别有明确范围。
- 可调用工作流统一返回 selected／verified，根门禁逐一检查 needs 的工作流结果与标记。缓存键及恢复前缀明确包含 repository 或 desktop，不依赖跨工作流 job ID 唯一。

没有删除现有验收断言、减少六目标或启动样本，也没有预建 Web、官网或服务端。

## 本机验证

Windows x64、Node 24.11.1、pnpm 11.11.0，继续使用锁定依赖：

| 验证 | 结果 |
| --- | --- |
| pnpm check | 通过；50 个类型／构建任务、54 个 lint／构建任务；54 项普通测试 |
| pnpm desktop:packages:test:consumers | 八包 pack、publint／ATTW，以及隔离工程中的 TypeScript、Node、无框架页面和 Solid 页面通过 |
| actionlint 1.7.12 | 五份现有 workflow 通过 |
| 实际 Turbo 图回归 | 标题 workflow、包测试配置、应用测试类型配置不选择桌面验收；包测试文件仅选择所属包 lint |
| 输入与依赖回归 | 测试配置不改变构建身份、不发出包重建通知；新生产配置继续发出通知；域外源码遵守工程隔离，普通共享产品库不被误拦 |

本机完整检查和消费者日志分别见 [check.log](check.log)、[consumers.log](consumers.log)，消费者报告见 [consumer-results.json](consumer-results.json)，八包收据见 [package-inputs.json](package-inputs.json)。真实工作流选择、汇总门禁及远端六目标运行继续验证，尚未计为通过。

实现中的首次检查发现并修正了共享 ESLint 通配输入包含生成目录、dependency-cruiser 拒绝过于复杂的过滤表达式，以及改名后换行触发的 curly 错误。使用未提交工作区验证 Git 范围时，Turbo 同时纳入未提交的全局配置变化；该探针不用于判定单文件选择，后续改在已提交的干净基线上运行。

## 上游依据

采用原生 [pnpm run](https://pnpm.io/cli/run) 区分脚本与内置命令；Turbo 按[任务 inputs](https://turborepo.dev/docs/reference/configuration)声明实际共享输入。dependency-cruiser 的 [doNotFollow](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#donotfollow-dont-cruise-modules-any-further) 同时过滤初始扫描范围、保留被维护源码直接引用的目标边，因此从仓库根扫描仍能保留第三方和测试目标的边界检查。
