# 存档归档与内容树摘要

2026-10-24，按[存档归档合同](../../../../design/domains/backups.md#archive-format)核对版本 1 清单、ZIP 成员与 UTF-8 内容树摘要。摘要覆盖内容和目录结构，文件时间单独处理。

[verify-backup-format.py](verify-backup-format.py)使用合成目录、空目录和一份中文文件，在内存中生成 Store 与 Deflate 两种实际 ZIP，再读回完整成员与字节，并核对 UTF-8 名称标志。两份归档故意使用不同成员顺序和时间；附件 SHA-256 不同，同一内容树摘要保持一致。Node JSON.stringify 与 Python 对同一树行得到相同 UTF-8 字节；另核对空文件与空目录的区别。共 11 项观察通过，见[结果](backup-format-results.json)、[确切编码输入](canonical-input.json)及[Store](stored.zip)／[Deflate](deflated.zip)样本。

试件验证容器布局与确定编码。恶意 ZIP、ZIP64 大输入、平台路径冲突、刷盘和实际恢复由[存档验收](../../../scenarios/sessions.md#backup-format)和[原生验收](../../../scenarios/engineering.md#private-native)执行。

```text
python verify-backup-format.py --node <node-executable> --out <new-output-directory>
```

新输出目录必须尚不存在，脚本不会读取用户存档或改动用户目标。
