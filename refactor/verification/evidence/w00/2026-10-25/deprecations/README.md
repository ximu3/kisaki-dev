# 弃用 API 与工程配置检查

本轮依据当前锁定版本检查自维护源码、声明、工具、配置、测试及消费者样板。实现质量要求原已见[编码规范](../../../../../design/engineering/conventions.md#quality)，本轮补充了[弃用接口处理](../../../../../design/engineering/conventions.md#deprecated-apis)的具体边界。

## 已处理的调用

唯一发现为根 eslint.config.ts 中的 `tseslint.config(...)`，其类型声明标记为弃用。按 [typescript-eslint 的官方迁移建议](https://typescript-eslint.io/packages/typescript-eslint/#config-deprecated)，改为 ESLint 自身的 `defineConfig`，保留原有配置对象与顺序。

当前版本为 TypeScript 6.0.3、ESLint 10.13.0、typescript-eslint 8.72.0、Node 24.11.1。没有新增依赖或改变依赖版本。

## 检查范围与结果

审查沿实际 typecheck 项目及 references 展开，在每个项目的语言服务上下文中取得建议诊断，保留同一引用所处的项目归属。消费者样板先在独立工程中安装真实 tarball，再按自己的四个类型项目检查，避免未安装依赖造成漏检。

| 项目 | 结果 |
| --- | --- |
| TypeScript 文件覆盖 | 170 个文件，64 个类型项目上下文，未覆盖文件为 0 |
| 弃用引用 | [迁移前 1 处](before.json)，[迁移后 0 处](after.json) |
| 语义及配置诊断 | 两轮均为 0 错误 |
| ESLint 有效配置 | [迁移前](eslint-before.json)与[迁移后](eslint-after.json)逐文件摘要一致，覆盖 170 个文件的配置与忽略状态 |
| 已启用的弃用 ESLint 规则 | 0；实际 lint 处理 169 个文件，生成的 binding.d.ts 按既有规则忽略 |
| 普通检查 | [pnpm check 通过](check.log) |
| 本机 Rust 检查 | [格式与 Clippy 通过](native-check.log)，Clippy 保持 `-D warnings` |

TypeScript 的弃用提示属于语言服务建议诊断，普通 tsc 通过不能代替这项检查。本轮采用临时审查工具，没有新增常驻审查任务或切换整个仓库的 lint 类型检查模式。该结果针对已锁定版本的弃用标记，不表示已经审计所有架构选择或所有上游漏洞。

后续六目标验证补查发现，窗口用例的 `click({ noWaitAfter: true })` 使用了弃用配置属性。上述检查没有识别对象字面量中的这项上下文属性，不能据其零引用结果推断所有调用选项均无弃用。关闭时序修正已移除此参数并完成本机 20 次回归，详见[CI 修正记录](../output-access/ci/README.md)。原始检查数据保留当时的实际覆盖。

## 工具链维护项

锁文件另有四项上游弃用通知：boolean 3.2.0、glob 7.2.3、inflight 1.0.6、rimraf 2.6.3。[依赖链](dependency-warnings.json)指向 Electron 下载、打包和安装器工具，属于应用 devDependencies 的传递依赖，并非自维护源码中的直接 API 调用。

这些通知作为工具链维护项保留，随父工具的兼容升级评估；本轮没有执行漏洞可达性评估，也没有通过强制覆盖版本或依赖补丁清空通知。

桌面运行输入标识仍为 `a448219d7697bb7dae0ebed6172746b29a1c91725a29278a10c514b7fcc05d1d`，与既有本机候选一致，见[输入核对](runtime-inputs.json)。本轮未重复执行真实桌面、制品或六目标 CI。具体结果见[汇总](summary.json)，报告摘要见[文件清单](files.json)。
