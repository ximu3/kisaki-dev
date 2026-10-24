# libmpv 能力目录与设置写入检查

[probe.py](probe.py)在隔离子进程中加载此前固定摘要的 Windows x64 libmpv 构建，关闭用户配置、自动脚本和实际音频输出。它读取能力定义，并用自有脚本及 profile 验证设置入口；未加载用户媒体或用户配置。

```sh
python refactor/verification/evidence/libmpv-catalog/probe.py
```

## 完整读取的目录

[catalog.json](catalog.json)记录该构建的 87 个命令、1011 个属性名称与 870 个选项名称。命令含参数名称、类型、可选标志、默认值与可得的 choices；选项保存可得的类型、范围和 choices，不保存可能包含主机路径的默认值。INT64 在证据 JSON 中以 int64 字符串标记，非有限浮点以 double 字符串标记，避免把 JSON 的限制误当作原生值合同。

固定设计提交的 client.h 仍有 45 个公开函数，与已有[Client API 归属清单](../libmpv-control/client-api-coverage.json)对应。目录运行输入是独立的 Client API 2.6 探针构建，不能当作最终发行或设计基线 2.5 的完整目录；准确身份与计数见 [runtime-contract.json](runtime-contract.json)。

目录不能机械地等同于完整类型：

- 14 个选项名称的 option-info 查询返回 PROPERTY_NOT_FOUND，包括部分 CLI 别名和已替代名称；原始错误码随名称保留。
- command-list 中 optional=false 不一定表示实参必须出现；screenshot-raw 的 flags 和 format 均有默认值，实际调用可以省略。
- Flags、Choice、Key/value list 等仍有各自的原生解析规则。未知名称的通用入口不能用宽泛重载绕过已知名称的检查，也不能通过不完整枚举拒绝上游实际支持的形式。
- property-list 只给名称，没有给每个成功结果的完整结构。结构化属性与命令返回值仍需依据源码和运行样例补齐。

本组完成了真实目录采集，未生成或宣称完成全部 TypeScript 参数与结果声明。

## 设置入口的实测

初始 vo 为仅含 libmpv 的对象设置列表，target-trc 为 srgb。直接 mpv_set_property_string、显式 Lua 脚本，以及配置文件中的 profile 经 apply-profile 应用后，均成功把 vo 改为 null、target-trc 改为 linear。

这证明上游不会自动保护绑定的受管设置。本组核心没有加载视频，因而这里仅核对设置被接受；后续[GPU 原型](../libmpv-gpu/verification.md)另验证实际驱动切换与颜色像素变化。[固定源码](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/command.c)也表明 UPDATE_VO 会触发输出重建。完整取舍见[受管输出边界比较](../libmpv-managed-output/design-choices.md)。

探针没有实现原生设置保护，nativeSettingsGuardImplemented 保持 false。尚未验证配置恢复、并发目标变更、真实保护补丁与其他平台。
