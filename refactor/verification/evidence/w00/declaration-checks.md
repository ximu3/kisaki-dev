# 声明检查分工的依据

常规项目使用 `strict: true` 与 `skipLibCheck: true`，公共包的仓库外声明消费者及自有声明拥有层执行完整声明检查。正式责任由[类型检查分工](../../../design/engineering/workspace.md#declaration-checks)定义。

[TypeScript 性能说明](https://github.com/microsoft/TypeScript/wiki/Performance#skipping-dts-checking)及[选项说明](https://www.typescriptlang.org/tsconfig/skipLibCheck.html)区分调用方源码检查与声明内部检查：该开关减少重复声明检查，也会跳过自有 `.d.ts`，因此自有声明和公共交付声明仍需明确的完整检查入口。[Turbo 基础模板](https://github.com/vercel/turborepo/blob/main/examples/basic/packages/typescript-config/base.json)和 [Vite 工具模板](https://github.com/vitejs/vite/blob/main/packages/create-vite/template-react-ts/tsconfig.node.json)提供了相同默认组合的使用实例。

2026-10-27，在 Windows x64 对同一 `@kisaki3/eslint-config` 项目执行 `tsc -p tsconfig.json --extendedDiagnostics`，第二次只增加 `--skipLibCheck`。项目没有启用增量检查，两次均通过：

| 编译器报告 | false | true |
| --- | ---: | ---: |
| 输入文件 | 310 | 310 |
| 声明行数 | 84,333 | 84,333 |
| TypeScript 源码行数 | 196 | 196 |
| Check time | 3.28 s | 0.04 s |
| Total time | 3.85 s | 0.59 s |
| Memory used | 888,703 K | 120,614 K |

单次诊断说明该项目的主要成本来自声明内部检查，不是 CI 峰值内存或稳定性能基准。代价是普通项目不再发现所有未使用的依赖声明内部冲突；公共消费者与自有声明拥有层承担相应检查，依赖升级中的实际不兼容继续处理。

类型感知 ESLint 使用 [Project Service](https://typescript-eslint.io/getting-started/typed-linting/)读取实际项目与依赖声明，规则按异步和类型风险选择。根 `lint:fix` 经原有 Turbo 依赖图准备声明，并使用其原生 cache 选项关闭修复运行的任务缓存；根测试的跨项目 lint 用例通过显式任务依赖取得 extension-cli 的构建声明。干净副本、类型、lint 与消费者结果见[W00 验收](README.md)。
