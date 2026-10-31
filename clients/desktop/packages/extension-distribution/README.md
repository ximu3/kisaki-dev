# @kisaki3/extension-distribution

本包拥有扩展身份、manifest、registry、兼容性与静态多语言文字合同。纯入口不读取文件或建立网络连接；Node 签名入口单独提供 JCS／Ed25519 签署与验证。

## 公开入口

```ts
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
```

`/metadata` 的 LocalizedText 可以是普通字符串，或以 locale 为键的文字映射，按声明的 defaultLocale 解析。`/identity`、`/manifest`、`/registry` 与 `/compatibility` 提供相应纯值及校验，包根集中导出这些能力。

`/node/signing` 接收显式密钥与完整 registry 文本，签名覆盖允许的扩展字段；验签失败不会返回可用目录。密钥取得、信任管理、网络获取及安装由调用方负责。

## 构建与验证

在本包目录运行：

| 命令                 | 结果                                                            |
| -------------------- | --------------------------------------------------------------- |
| `pnpm build`         | 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。 |
| `pnpm run pack`      | 生成 `out/package.tgz`。                                        |
| `pnpm check:package` | 使用 publint 与 Are the Types Wrong 检查已完成的 tarball。      |
| `pnpm typecheck`     | 检查本包源码及工程配置。                                        |
| `pnpm lint`          | 检查本包的工程与源码规则。                                      |

仓库根的 `tests/desktop/consumers` 使用真实 tarball 验证跨包消费。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
