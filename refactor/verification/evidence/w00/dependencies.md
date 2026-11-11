# 工程依赖风险评估

2026-11-11，结合锁文件审计、上游公告和实际调用核对以下工程依赖。按当前输入来源与使用范围评估，相关告警属于非阻塞维护事项，不阻塞 W05 或当前工程交付，随兼容的上游更新处理。

| 依赖与当前版本 | 当前使用范围 | 公告触发条件 |
| --- | --- | --- |
| extract-zip 2.0.1 | Windows 制品测试只展开本次自行构建的 ZIP。 | 恶意归档中的链接条目及同名条目可造成越界访问或写入，见[链接目标](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)和[同名条目](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)公告。 |
| glob 13.0.6 | 由 @electron/asar 4.3.1 引入；仓库直接使用 ASAR 的读取与列表接口。 | [取消后继续遍历](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)影响依靠 AbortSignal 限制遍历成本的调用；当前业务没有依赖该安全边界。 |
| minimatch 10.2.6、9.0.9 | ESLint、typescript-eslint、ASAR 和 electron-builder 处理工程检查与打包规则。 | 攻击者可控的匹配模式在特定优化配置下产生[处理开销放大](https://github.com/advisories/GHSA-g3hv-75wg-m249)；当前模式来自工程规则。 |

后续按[普通依赖维护](../../../design/engineering/workspace.md#dependencies)核对兼容修复；若使用范围变为接纳不可信归档或外部匹配规则，则按新的输入边界重新评估。
