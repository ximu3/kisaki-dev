# W00 收尾验证

2026-10-29，按用户授权落实 GitHub 合并约束，并对 Windows 输出交接的历史 EPERM 做定向核对。W00 的工程、资源、开发和测试入口已有[六目标运行证据](https://github.com/ximu3/kisaki-dev/actions/runs/40707331506)；本记录补充仓库设置与输出交接结果。产品功能、正式发行和独立项目按各自工作包交付。

<a id="repository"></a>

## 仓库设置

`ximu3/kisaki-dev` 的 `main` 已启用 GitHub 原生分支保护，并通过独立读取确认：

- 必须经 PR，分支保持与最新主线同步；`verify / Required checks` 和 `PR title` 必须由 GitHub Actions（app ID 15368）提供成功结果。
- 规则约束管理员；审批人数为 0，不要求额外审批者或最后推送者之外的审批。
- 主线保持线性历史，禁止强制推送和删除。
- 仓库仅允许 Squash，合并后自动删除远端分支；现有 Squash 默认标题与正文继续分别采用 PR 标题和正文。

变更前、正式请求和读回结果见[设置记录](repository.json)。严格检查意味着主线前进后需要同步分支并重新取得相应检查结果，符合[协作合同](../../../../../design/engineering/workspace.md#collaboration)。实现使用 [GitHub 分支保护 API](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)和[仓库设置 API](https://docs.github.com/en/rest/repos/repos#update-a-repository)，没有新增自定义合并服务、审批流程或自动合并。

本次没有执行 PR 合并、主线直接推送、历史分支批量删除或制品发布。

<a id="output"></a>

## Windows 输出交接

三份历史日志的失败点均为完整候选目录改名到正式输出：桌面有限构建、extension-distribution 与 extension-sdk。相关实现集中在 `packages/tooling/src/output.ts`。tsdown 0.23.0 的一次性构建等待构建结果和 postBuild；其 `watch.close()` 只适用于监听模式，没有据此给一次性构建添加不适用的关闭调用。

| 核对 | 实际结果 |
| --- | --- |
| 占用识别 | 用独立 PowerShell 进程持有不共享删除权限的文件句柄，目录改名得到 EPERM；Windows Restart Manager 正确返回夹具进程 PID。只调用资源查询，没有关闭或重启其他应用。 |
| 真实顺序构建 | extension-sdk 与 extension-distribution 各调用实际构建工作流 20 次，40 次全部通过。 |
| 原任务调度条件 | 三次 `pnpm lint --force` 均执行 54 项实际任务，缓存全部绕过；在候选改名失败处安装占用查询，未出现自然 EPERM，也没有产生失败捕获。 |
| 失败保护 | 在实际 replaceOutput 的候选中施加外部文件占用，确认交接改名失败。识别持有进程并释放夹具锁后，旧输出恢复、失败候选清理及后续显式构建均通过。 |

结果与范围见[validation.json](validation.json)，原始日志、观测及诊断输入保存于[diagnostics.zip](diagnostics.zip)。现场使用 Windows 10 x64、Node 24.11.1、PowerShell 7.6.9 与本地 NTFS，进程未提升权限。查询依据 [RmRegisterResources](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmregisterresources) 和 [RmGetList](https://learn.microsoft.com/en-us/windows/win32/api/restartmanager/nf-restartmanager-rmgetlist)；资源按文件批量登记，查询后结束会话。

历史日志没有记录占用者，本次未复现的结果不能补出当时的进程身份，也不证明历史事件已经修复。现有失败保护得到验证；没有修改输出交接实现、增加自动重试或将失败降级为成功。再次出现时，可使用归档的改名现场捕获记录区分内部资源未释放与外部占用。

## 完成范围

W00 的工程与测试入口、六目标基础运行和仓库合并约束均有实际结果，状态记为完成。历史未归因事件保留各自输入与观察范围，完整产品、签署、安装升级及独立后端不记作本包已完成内容。当前交付状态由[实施状态](../../../../../implementation/status.md)维护。
