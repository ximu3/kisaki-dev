# skipLibCheck 的必要性与建议边界

本页评估原有 `skipLibCheck: false` 默认是否值得继续维持。用户已确认采用“常规开启，公共消费者和自有声明拥有层关闭”的边界，正式实现与验证见[采用记录](../../declaration-checks/2026-10-27/README.md)。`strict` 与本开关分别判断，自有 TypeScript 源码继续严格检查。

## 依据

[TypeScript 官方性能说明](https://github.com/microsoft/TypeScript/wiki/Performance#skipping-dts-checking)指出，对全部声明文件重复完整检查通常没有必要，但跳过它可能掩盖声明冲突。[选项说明](https://www.typescriptlang.org/tsconfig/skipLibCheck.html)也明确：调用方代码仍根据声明进行类型检查，开关会跳过全部 `.d.ts` 的完整检查，包括自有声明。

这不是只能用于应急的非标准做法。[Turbo 官方基础模板](https://github.com/vercel/turborepo/blob/main/examples/basic/packages/typescript-config/base.json)同时使用 strict: true 和 skipLibCheck: true；[Vite 的工具配置模板](https://github.com/vitejs/vite/blob/main/packages/create-vite/template-react-ts/tsconfig.node.json)也启用 skipLibCheck。模板提供实际采用依据，不替代本项目的声明交付责任。

## 本机代表性对照

对同一个 `@kisaki3/eslint-config` 项目执行现有 `tsc -p tsconfig.json --extendedDiagnostics`，第二次只增加 `--skipLibCheck`。该项目没有启用增量检查，两次均通过，未修改配置或依赖。

| 编译器报告 | false | true |
| --- | ---: | ---: |
| 输入文件 | 310 | 310 |
| 声明行数 | 84,333 | 84,333 |
| TypeScript 源码行数 | 196 | 196 |
| Check time | 3.28 s | 0.04 s |
| Total time | 3.85 s | 0.59 s |
| Memory used | 888,703 K | 120,614 K |

这是 Windows 本机的单次编译器诊断，不是 CI 的峰值内存或稳定性能基准。它说明该项目的主要检查成本来自声明内部验证。33 个官方扩展的工程配置都消费相同的 ESLint／工具声明，当前各自维持 false 会重复这类工作。

## 建议

建议常规应用、工具、配置和公共包源码检查默认使用 `skipLibCheck: true`，保持 `strict` 及既定源码检查。公共包的实际打包声明继续由已有仓库外 Node／Webview／Solid 消费者使用 false 验证；不把消费者的完整声明检查一起移除。

自有 `.d.ts` 不能随默认切换而遗漏。当前只有应用的 build.d.ts、renderer/environment.d.ts 和原生 binding.d.ts；可沿现有 shared、renderer、main 的所属类型项目保留完整检查，不新建跨仓测试框架。原生声明还继续接受实际 Rust 生成结果的一致性核对。未来新增自有声明时明确其拥有者。

这比每个普通消费项目重新验证整套第三方声明更有针对性。代价是普通消费项目不再发现所有未被使用的依赖声明内部冲突；公共声明消费者及自有声明拥有层保留相应责任，依赖升级中出现的真实不相容仍须处理。

[正式规范](../../../../design/engineering/workspace.md#declaration-checks)原先要求纯合同、SDK、工具源码等保持 false；经用户确认已按上述责任重新划分。普通类型检查仍验证所有自有源码和调用，公共声明及自有声明保留完整检查。本页的单次测量不把 CI 的停滞未经证实地归因于此开关。
