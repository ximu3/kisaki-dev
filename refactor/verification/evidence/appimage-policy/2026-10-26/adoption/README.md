# AppImage 条件兼容策略的采用与验证

2026-10-26，用户在[两条政策的实测比较](../README.md)后确认采用上游条件兼容行为，同时去除桌面入口无条件附加的 --no-sandbox。正式合同见[构建与发行](../../../../../design/engineering/build.md#appimage-compatibility)。按路径准备权限是比较过的备选方案，没有加入产品流程。

## 正式修改

本体 electron-builder.yml 增加 appImage.executableArgs: []，沿用 electron-builder 26.15.3 的原始 AppRun。允许命名空间时保留 Chromium 沙箱；上游检测到限制时允许降级启动。没有增加自定义启动脚本或应用内探测。窗口配置、最小 preload 和七项 fuses 保持原样；不据此承诺降级环境仍有操作系统级进程沙箱。

最终制品用例增加 Linux .desktop 的实际输出检查，要求 Exec 为 AppRun %U，防止打包器重新引入无条件降级参数。Webview 规范同步说明载体的实际进程隔离边界。

## 输入与复现

- [成功运行 40310558001](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40310558001)，提交 `b87c1238e68846f25b46ec63d454a4ba83b85b18`，独立研究分支 `research/appimage-policy-2026-10-26`。
- Ubuntu 24.04.5 x64、内核 6.17.0-1022-azure，普通用户 UID 1001；Node 24.11.1、Electron 44.5.1、electron-builder 26.15.3。
- 探针读取从本体复制的 [application-builder.yml](ci-40310558001/application-builder.yml)，实际采用其中的 AppImage 参数和 fuses。该文件与本体配置的 SHA-256 都是 `35803ee34fbbc78e07d90f48f22af153592e45a8dadd2eec976632630ecfce14`。
- [source-inputs.json](source-inputs.json)保存输入摘要；[probe-adoption.patch](probe-adoption.patch)保存相对原探针提交 `49a2df7` 的增量。完整可复现源码位于上述提交的 `refactor/verification/evidence/appimage-policy/2026-10-26/probe`，由同提交的 `.github/workflows/appimage-policy-probe.yml` 运行。
- 依赖使用实际作业的 [package-lock.json](ci-40310558001/package-lock.json)。新配置对应的 AppRun 与默认上游脚本逐字节一致，最终 [.desktop](ci-40310558001/results/conditional.desktop)包含 Exec=AppRun %U。

## 实测结果

原十项启动对照及路径通配对照保留，新增采用配置的三项实际运行；十三项启动场景均符合各自预期。

| 采用配置的运行条件 | 实际结果 |
| --- | --- |
| 允许用户命名空间 | 渲染就绪，独立的 user、pid、net namespace，Seccomp=2，未附加 --no-sandbox |
| AppArmor 限制未授权的用户命名空间 | 上游附加 --no-sandbox，渲染就绪，与主进程共用上述 namespace，Seccomp=0 |
| user.max_user_namespaces=0 | 上游附加 --no-sandbox，渲染就绪，Seccomp=0 |

原始进程状态、命令行、版本、fuses、逐场景日志和文件摘要见 [result.json](ci-40310558001/results/result.json)。作业信息与日志见 [run.json](ci-40310558001/run.json)、[run.log](ci-40310558001/run.log)。隔离 VM 中的系统条件已恢复，试件 profile 已移除，全部清理命令成功。

本机本体 typecheck 与所改制品用例的 ESLint 检查通过。新制品断言进入既有 Linux 制品任务；本次没有重新构建完整 Kisaki 六目标制品，也未把探针记作该断言的本体运行通过。

## 证据范围

本次验证采用配置在真实 Ubuntu 24.04 x64 AppImage 中的启动行为，并核对生成的桌面启动参数。未执行 GNOME／KDE 图标点击、ARM64、其他发行版、完整更新下载或本体业务验收。沙箱降低是已接受的运行取舍，不是所有 Linux 启动问题的通用修复保证。当前六目标与后续业务的未完成状态保持独立登记。
