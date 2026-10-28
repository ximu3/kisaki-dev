# 八个公共包与真实消费者审查

日期：2026-10-28。基线为 `ad9113d0c9eb0d83ee32e876a2aa8cab35fdbffe`，读取并核对 123 个受维护文件：八包的全部当前源码、配置、工具、测试、README/许可证，根 tests/desktop 全部输入，以及 tools/desktop/package-inputs.ts、config/vitest/vitest.config.desktop-consumers.ts。逐文件结果与读取摘要见 [public-packages-coverage.json](public-packages-coverage.json)。

## 结论

当前公开入口履行其实际声明的职责，没有发现业务未实现却返回成功、测试替身进入正式路径或绕过公共拥有者的实现。W00 工程入口不等于完整 W01/W03/W08 产品能力；本次没有扩张交付范围、添加空模块或恢复旧协议。

| 包 | 当前实际职责与核对结果 |
| --- | --- |
| appearance | 45 项 token 词表、双套默认值、从同一已编译值生成 CSS，以及 Tailwind 映射；字体和桌面身份由宿主拥有。 |
| ui | 实际 Solid Button、原生属性透传与成品 CSS；Solid 保持 peer，CSS 不注入全局 Preflight，消费者无需 Tailwind。 |
| desktop-contracts | ErrorSummary/ExecutionFailure 和开发父子消息/纯校验；没有 I/O 或 Electron 运行依赖。 |
| extension-api | 从 desktop-contracts/errors 明确转导出同义值，无同形复制。 |
| extension-sdk | 经 extension-api 提供作者错误合同，没有直接依赖 desktop-contracts 或应用私有代码。 |
| extension-distribution | LocalizedText 纯合同，类型出口与发布文件一致。 |
| rpc | 环境无关 MessageTransport 类型，未将连接运行实现假装成已提供能力。 |
| extension-cli | 纯 config/defineConfig 和实际 Node 开发启动器；无虚构 bin/模板，进程退出、连接失败、正常 stop 与明确 terminate 分开。 |

各包只通过构建后的 exports 被消费。构建/清理入口归各包，候选输出交接复用 @kisaki3/tooling/output；相同短任务结构具有独立输出所有权，不因代码相似增加平行构建机制或额外抽象。

源码与实际消费者同时核对：应用通过 desktop-contracts/development 与 extension-cli/extension 接入同一父子协议；应用样式消费 appearance/ui 的正式 CSS。另读取 main/app 的 development、launch、shutdown，renderer 的 window-root/base.css，以及 dev/session、dev/dependencies、lib/package-inputs 的相关消费与交接路径。上述读取用于交叉核对，不将其计为整份桌面代码审查。

根消费者通过实际 tarball、哈希、清单身份及声明版本范围建立独立临时工程，完整声明检查保留 skipLibCheck=false。Node 执行、框架无关页面和 Solid 页面分别消费实际入口；浏览器检查色值、按钮更新和样式不侵入无关内容。测试目录中的合成源码属于测试试件，CLI 作者模板当前没有实现，二者没有混同。

## 已授权的小修正

1. 八包 README 删除 W00/W01/W03/W08 的实施经过与未来工作表述，改为当前实际导出、使用方法和状态入口；消费者 README 同样按实际职责说明，保留与作者模板及宿主验收的边界。
2. desktop-contracts/src/development.ts:32 将 apiVersion=null 的注释改为当前不开放扩展运行 API，保留值与运行语义。
3. desktop-contracts/src/development.test.ts:9、30、32、38 将 removed/superseded 的旧方案叙述改为拒绝未知字段和 outcome；有效构建/激活事实、两项额外字段及非法 outcome 的断言全部保留。

没有修改启动器、消息解析行为、公共值形状、package.json、构建脚本或消费者执行逻辑。

## 验证

`pnpm --filter @kisaki3/desktop-contracts test` 通过：Vitest 5.0.5，1 个文件、1 项测试，2026-10-28 18:52 本地时间。公共包和消费者 README 的本地文件/锚点链接通过静态核对；本范围 `git diff --check` 通过。

本次未重跑真实 tarball 安装、浏览器、应用、打包或六目标测试。这些运行行为没有修改，原有运行证据保持其原提交与范围；完整合同实现的未完成状态没有因文字修正而改变。最终统一格式与全仓检查由主代理负责。
