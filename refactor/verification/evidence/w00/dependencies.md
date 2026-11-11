# 工程依赖的安全核对

2026-11-11，使用仓库锁文件执行 `pnpm audit --json`，并核对实际调用、上游公告和 npm 已发布版本。结果为 2 条 high、2 条 moderate，涉及三个工程依赖；这些公告尚未消除。

| 依赖与当前版本 | 当前使用范围 | 修复条件 |
| --- | --- | --- |
| extract-zip 2.0.1 | `tests/support/artifact-workspace.ts` 仅在 Windows 展开本次构建的 ZIP，供制品运行检查使用。 | 两条公告涉及链接条目越界和同名条目经链接写入。npm 的 latest 仍为 2.0.1，直接查询 2.0.2 无对应版本；审计响应给出的 `>=2.0.2` 不能作为已经取得修复的证据。 |
| glob 13.0.6 | 由 @electron/asar 4.3.1 引入。仓库直接使用 ASAR 的读取与列表接口。 | 上游修复为 14.0.2，超出 ASAR 当前的 `^13.0.2` 范围；需由依赖拥有者完成兼容接入。 |
| minimatch 10.2.6、9.0.9 | ESLint、typescript-eslint、ASAR 和 electron-builder 的工程依赖路径，处理仓库检查与打包规则。 | 上游修复为 11.0.1，超出现有依赖范围。查询到的 ESLint 10.14.0 仍声明 `^10.2.6`；只升级其当前小版本不能消除该问题。 |

公告依据：[extract-zip 链接目标](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)、[extract-zip 同名条目写入](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)、[glob 取消后遍历](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)、[minimatch 模式放大](https://github.com/advisories/GHSA-g3hv-75wg-m249)。

当前调用使用工程输入，上述核对不构成接纳不可信归档或任意外部 glob 的保证。依赖图中的 dev 标记也不能代替实际分发边界判断：私有 eslint-config 的依赖属于工程工具，公共包的正式制品由各自消费者检查。

处理遵守[依赖更新](../../../design/engineering/workspace.md#dependencies)及[公开 API 与弃用规则](../../../design/engineering/conventions.md#deprecated-apis)。优先采用上游完整修复；替换解压或打包能力时核对支持格式、目标平台、失败与清理，再运行相应制品检查与审计。当前结果按未解决维护。
