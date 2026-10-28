# Turbo 构建输入身份接入

按用户已确认方案，有限构建的输入身份直接采用锁定 Turbo 2.11.10 的公开 dry-run 任务图。`app/tools/build/identity.ts` 通过 `@kisaki3/tooling/process.readPnpm` 在真实仓库根调用 `pnpm exec turbo run build --filter=@kisaki3/desktop --dry=json --cwd <root>`，只读取 `@kisaki3/desktop#build.hash`。不存在目标任务或hash不符合锁定版本的16位十六进制输出时明确失败，没有目录摘要后备算法。原函数名交主代理统一改为 buildInputIdentity。

`runtimeFiles` 原有逻辑未改，逐文件 SHA-256 继续表示实际输出字节。任务hash表达Turbo输入身份，不表示各开发代际文件逐字节相同，也不替代输出核对。

测试改为真实Turbo和隔离最小workspace：复制当前根/app Turbo配置；以真实pnpm离线lockfile-only记录公包依赖；在自有临时Git仓库固定输入。工具从真实根调用，试件不另装Turbo。五项行为验证如下：

- 生产源码、Vite配置、公包源码/嵌套生产编译配置、.node-version与.npmrc改变身份。
- 文档、开发工具、打包工具/配置以及公包/应用验证配置不改变有限构建身份。
- 生成输出不改变输入身份，而同一运行文件字节变化改变其SHA-256。
- 已声明TSDOWN_*环境值改变任务身份。
- 缺少桌面任务时失败。

没有mock摘要或维护第二份输入展开器。没有断言私有工程测试配置不影响身份：真实根依赖的全局摘要会纳入相应私有包输入，这是锁定Turbo的公开行为边界；主代理的input-identity-probe.json保留了实际对照。

`app/tests/support/development-workspace.ts` 补齐 .node-version 复制，使隔离开发工程携带同一已声明全局输入。主代理同步package任务透传TSDOWN_*，并负责调用命名、开发监听、其他消费者和正式文档。

验证：`pnpm run test tests/tools/build/identity.test.ts` 最后一次5用例通过，Vitest5.0.5报告13.03秒；三个改动文件的ESLint、Prettier检查和git diff --check均通过。没有运行编译器、桌面、性能或制品验收。原生SQLite单项测试是此前独立的小修正验证，见desktop-runtime-review.md。

一手依据：[Turbo run --dry](https://turborepo.dev/docs/reference/run#--dry----dry-run)公开列出taskId、hash、inputs、dependencies与environmentVariables等字段；此处只解析实际消费的任务身份与hash。

## 集成后的接口

正式函数为 buildInputIdentity，接收可选 root 与 signal；任务 hash 作为非空不透明字符串消费，不固定长度。所有构建、开发和打包调用贯通取消信号；package 任务显式传递 TSDOWN_*，避免严格环境下丢失构建输入。最终全仓与真实流程结果见 README。
