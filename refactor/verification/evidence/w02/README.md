# W02 extension-distribution 验证

2026-11-03，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3 和 Playwright 1.64.1 下复核 0.1.0-dev.0 包实现、制品与独立消费。工作包进度与远端验收结果见[实施状态](../../../implementation/status.md#progress)。

## 合同与本机结果

| 范围 | 实际结果 |
| --- | --- |
| manifest 与静态文案 | 完整必需及可选字段、单段与多段 ID、包内相对路径、六目标、SemVer 和可定位错误通过。程序化输入的数组逐项校验，空槽不会被跳过。ID、SHA-256 与 Base64 签名要求整串合法，末尾行终止符拒绝。读取保留未知分类，新增分类使用明确词表；规范化 locale、默认语言、别名冲突、同语言文字体系匹配与稳定候选顺序通过。 |
| 平铺索引与选版 | release、artifact、资源引用、首次发表时间及发行说明分别验证；最高稳定展示与最高兼容安装互相独立。重复身份、同优先级版本、目标重叠拒绝；预发布偏好、更高版本限制和多目标同一制品成立。 |
| 不可变制品 | 保留版本的包摘要、大小、目标、兼容条件、许可与首次发布事实不能改写；同版本新增目标拒绝。删除发布项、资源 URL 迁移和发行说明更正可进行。包内事实核对不错误比较当前目录文案。 |
| 签名与信任 | Node Ed25519 对独立构造的预期 JCS 字节验签通过。原相对 URL、未知字段、嵌套 signature 和未规范化 locale 均参与签名；重排 JSON 不改变签名。重复解码属性、无效 Unicode、非有限数、错钥、换身份、篡改与无效 Base64 均拒绝。首次 inspect 不建立信任。 |
| 字节与资源基准 | 先比较原始字节数，再比较 SHA-256；同长度损坏可识别。各层引用使用索引最终响应 URL，原始引用保持不变。 |
| 工程与纯边界 | 本包类型、lint、格式及 25 项行为测试通过。依赖边界和任务选择的仓库验证由 CI 记录；包代码和消费者输入变化能选择自身消费验证，不扩大到无关桌面运行。 |
| 仓库外消费 | 本包 3 项消费者检查通过。两个独立工程从仓库外安装同一 tarball，分别进行 NodeNext 与 Bundler 的完整声明检查、类型感知 lint 和实际运行。浏览器纯声明不需要 Node／DOM globals，Chromium 运行全部纯入口，Node 消费真实签名入口。 |
| 制品与说明 | 构建、单次 pack、publint 和 Are the Types Wrong 的 ESM 消费检查通过。tarball 包含六个公开子路径、声明、MIT 许可和英语发行说明；成篇使用文档由 W23 交付。实现依赖保留为外部 npm 包，公开声明不暴露校验库内部类型。 |

最终制品位于 `clients/desktop/packages/extension-distribution/out/package/package.tgz`，消费者报告位于该包 `test-results/consumers/results.json`。这两项由验证入口生成，不提交重复制品或临时安装副本。两个消费者的目录、浏览器和预览服务由测试作用域清理。

本次没有 npm 发布、仓库索引部署或应用安装操作。ZIP 解包、路径冲突与符号链接、真实入口加载、信任持久化、安装和更新事务继续由 W18／W19 的实际操作验收；这里验证它们共同消费的格式、纯规则与 Node 签名能力。

## CI 结果

[PR #20 的完整检查](https://github.com/ximu3/kisaki-dev/pull/20/checks)记录各输入 SHA 的仓库检查、Windows／macOS／Linux 的 x64 与 arm64 六目标工程回归、Required checks 和独立 PR title。各运行及其制品由该 PR 关联，最终门禁针对当前提交核对。

Linux x64 的 `Test public package consumers` 覆盖两个公共包的构建、打包、制品检查与仓库外消费。W02 的纯声明、浏览器运行和 Node 签名分别在本机 Windows x64 与该 CI 目标取得结果；六目标桌面工程回归不替代后续实际扩展安装与宿主接入验收。

## 实现依据与审阅

- 签名按 [RFC8785](https://www.rfc-editor.org/rfc/rfc8785.html) 和既定用途前缀执行，使用 [canonicalize](https://github.com/erdtman/canonicalize) 5.1.0；没有自行实现排序或数值序列化。签名输入保留原 JSON 数据，只移除顶层 signature，格式规范化在验签后交付。
- 使用 [Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 3.3.1 的公开 visitor，明确关闭注释、尾逗号和空文档；在原文解析时检查重复解码属性、Unicode 与有限数值，再由 JSON.parse 形成数据。普通 JSON.parse 会覆盖重复属性，因此不能独自承担这条签名边界。
- 兼容与优先级采用 [node-semver](https://github.com/npm/node-semver) 7.8.5；静态文案按设计筛选相同语言与文字体系后使用 [FormatJS matcher](https://formatjs.github.io/docs/polyfills/intl-localematcher/) 0.10.1。两者的实际锁定代码与独立浏览器运行均已核对。
- Ed25519、SPKI／PKCS8、签名和 SHA-256 使用 [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)；私钥只在调用方内存中生成或传入。本机身份不进入测试，签名用例使用合成密钥和资料。

人工审阅覆盖格式拥有层、完整公开声明、正常与拒绝路径、规范化和原文的区别、版本选择及字节不变、首次检查与已保存信任、公开入口的导入链、构建失败与取消时保留旧输出、消费者准备失败和结束后的清理。纯操作和密码操作不持有持续资源，构建交接沿用已有工程实现及其验证。
