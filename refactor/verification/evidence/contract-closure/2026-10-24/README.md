# 会话结果声明与存档格式检查

检查日期：2026-10-24。本页记录文件切换结果的声明消费检查，以及存档归档与内容树摘要的格式试件。正式规则分别归[文件切换](../../../../design/domains/sessions.md#switch)与[归档合同](../../../../design/domains/backups.md#archive-format)。

## 会话结果声明

FileSwitchResult 的 ready 分支携带就绪 Session，previousEnded 只用于失败中的合法部分结果，保存原 sessionId 与目标 fileId。

[verify-types.py](verify-types.py)从现行通信与会话文档提取两个声明块，结合本次检查需要的代表性 Session 类型生成[消费样例](contract-types.ts)。Node v24.11.1、TypeScript 6.0.3 下，三种媒介的正常分支、已结束分支、错误部分结果和判别收窄编译通过；八项预期类型拒绝有效。检查启用 strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess 与 noEmit，见[配置](tsconfig.json)和[结果](type-results.json)。

反例检查缺少就绪会话、跨媒介会话、游戏误用、缺少原会话或目标身份、将已结束分支当作新会话，以及非法半结果。Session 支持类型只表达这些检查需要的媒介与身份，不是完整公共声明。检查没有运行 switchFile、IPC、SDK、记录保存、资源释放或引擎；这些按[会话场景](../../../scenarios/sessions.md#file-switch)取得正式结果。

复核时提供当前规格根、已有 Node 和固定 TypeScript 的 tsc 路径，并使用一个尚不存在的输出目录：

```text
python verify-types.py --root <kisaki-root> --node <node-executable> --tsc <typescript-bin-tsc> --out <new-output-directory>
```

脚本只读取规格并在指定的新目录生成检查材料，不安装依赖，不覆盖本目录历史结果。结果保存实际版本与被提取文档的 SHA-256；后续正文修订后须重新执行并另存结果。

## 存档格式与确定编码

试件依据[归档合同](../../../../design/domains/backups.md#archive-format)中的 ZIP、版本 1 清单、成员范围与 UTF-8 内容树摘要。保存范围包括内容与目录结构，不包含修改时间。[文件同步](../../../../design/engineering/native.md#file-sync)和[持久化次序](../../../../design/domains/backups.md#durability)定义的运行保证不在本次试件覆盖范围内。

[verify-backup-format.py](verify-backup-format.py)使用合成目录、空目录和一份中文文件，在内存中生成 Store 与 Deflate 两种实际 ZIP，再读回完整成员与字节，并核对 UTF-8 名称标志。两份归档故意使用不同成员顺序和时间；附件 SHA-256 不同，同一内容树摘要保持一致。Node JSON.stringify 与 Python 对同一树行得到相同 UTF-8 字节；另核对空文件与空目录的区别。共 11 项观察通过，见[结果](backup-format-results.json)、[确切编码输入](canonical-input.json)及[Store](stored.zip)／[Deflate](deflated.zip)样本。

该试件只验证容器布局与确定编码示例，没有实现生产归档验证器，没有覆盖恶意 ZIP、ZIP64 的真实大输入、平台路径冲突、刷盘、目录项持久性或正式恢复，也没有执行掉电测试。相关断言继续由[存档验收](../../../scenarios/sessions.md#backup-format)和[原生验收](../../../scenarios/engineering.md#private-native)执行。

```text
python verify-backup-format.py --node <node-executable> --out <new-output-directory>
```

新输出目录必须尚不存在，脚本不会读取用户存档或改动用户目标。
