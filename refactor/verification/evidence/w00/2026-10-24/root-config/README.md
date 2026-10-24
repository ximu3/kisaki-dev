# 仓库根配置收尾与私有验证库接续

仓库根 tsconfig.json 组织工具、配置和测试三个类型项目，分别由 tsconfig.tools.json、tsconfig.config.json 和 tsconfig.tests.json 负责。根工具只使用 Node 与 ES2023，配置和测试按实际声明及浏览器回调需要包含 DOM。tsconfig.base.json 保留共同规则，tsconfig.boundaries.json 继续仅用于依赖图解析。

根工具目录保持 hooks.ts 与 release/package-inputs.ts，布局文档改为当前实际文件，并单独说明后续发行工作流。lint-staged 的 ESLint 调用增加 --no-warn-ignored，使已经声明忽略的历史证据与生成内容不会以“文件被忽略”的提示阻止提交；现有忽略范围和维护源码的零警告检查保持不变。

首次大批量提交实际触发 Windows 命令行长度限制，pre-commit 据此将 lint-staged 的单批参数上限设为 4,000 字符。另核对到 Git 自动换行转换会改变证据日志的已记录摘要，因此 .gitattributes 对验证证据目录保留原始字节；普通源码仍规范为 LF。

## 本机核对

- 根目录 12 个 TypeScript 输入完整保留，分别具有唯一类型项目归属；两个根工具不再获得 window、document 全局类型，见 [coverage.json](coverage.json)。
- TypeScript 6.0.3 语言服务核对全部 12 个文件的项目归属，语义诊断为空，见 [editor-projects.json](editor-projects.json)。
- `pnpm check` 通过全仓类型、lint、依赖边界、格式和常规测试，见 [check.log](check.log)。
- 提交检查调整后，忽略文件与配置自身的 ESLint 检查通过，9 项 hooks 生命周期与部分暂存恢复场景再次通过，见 [hooks.log](hooks.log)。

## 远端接续

已创建临时私有仓库 [ximu3/kisaki-w00-ci](https://github.com/ximu3/kisaki-w00-ci)，核实 private=true、当前账户拥有 admin 权限，Actions 已启用。创建信息见 [repository.json](repository.json)。GitHub CLI 当前令牌没有读取用户计费信息所需的 user scope，额度读取返回权限提示；预算与付费设置保持账户现有配置。

首次上传前枚举了约 23.8 MB 的工程、资源与历史证据，没有达到 GitHub 单文件大小限制的文件、符号链接或所扫描的常见凭据模式命中，见 [upload-audit.json](upload-audit.json)。该扫描记录实际覆盖，不等同于完整安全审计。

远端提交与工作流结果按[接续记录](../../../../../implementation/w00-remote-handoff.md)保存。W00 在六目标实际结果齐备并满足本包门槛后才能登记完成；创建仓库不构成验收通过。
