# 类型与声明检查依据

常规项目使用 strict 与 skipLibCheck 检查自有源码及其对依赖的调用。自有 .d.ts 和对外发布声明由明确的消费者执行完整声明检查，职责见[类型分工](../../../design/engineering/workspace.md#declaration-checks)。

TypeScript 的 skipLibCheck 跳过声明内部检查，包括自有声明；明确检查拥有者可以集中保证声明正确性，并减少普通消费者的重复工作。[TypeScript 选项](https://www.typescriptlang.org/tsconfig/skipLibCheck.html)、[性能说明](https://github.com/microsoft/TypeScript/wiki/Performance#skipping-dts-checking)

[源码覆盖用例](../../../../tests/workspace/typecheck-coverage.test.ts)沿真实类型任务和 references 核对维护范围，并确认每份自有声明具有完整检查拥有者。原生声明同时与实际 Rust 生成结果核对。

类型感知 ESLint 通过 [Project Service](https://typescript-eslint.io/getting-started/typed-linting/)读取实际项目，直接检查所属源码中的异步工作、判别联合和动态值使用。仓库外消费者在安装实际依赖后执行自己的类型与 lint 检查。运行结果见[工程验证](README.md)。
