# AppImage 启动验证

2026-10-26，在 Ubuntu 24.04.5 x64、内核 6.17.0-1022-azure、Node 24.11.1、Electron 44.5.1 和 electron-builder 26.15.3 下，验证[AppImage 兼容策略](../../../../design/engineering/build.md#appimage-compatibility)。应用以普通用户 UID 1001 运行。

## 输入

- [构建配置](application-builder.yml)使用 appImage.executableArgs: [] 和项目 fuses。
- [依赖锁定](package-lock.json)固定试件运行输入。
- [AppRun](AppRun.txt)与所用上游启动器一致，[桌面入口](application.desktop)为 Exec=AppRun %U。
- [来源记录](source-inputs.json)保存提交、运行地址、配置和依赖摘要。

## 实测结果

| 运行条件                          | 结果                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| 允许用户命名空间                  | 渲染就绪，独立的 user、pid、net namespace，Seccomp=2。              |
| AppArmor 限制未授权的用户命名空间 | 上游采用兼容参数，渲染就绪，与主进程共用上述 namespace，Seccomp=0。 |
| user.max_user_namespaces=0        | 上游采用兼容参数，渲染就绪，Seccomp=0。                             |

[结果记录](result.json)保存这三项场景的实际进程、命令行、版本、fuses 和文件摘要。隔离 VM 的 sysctl 值在测试结束后恢复。场景覆盖当前采用配置下的启动与进程隔离状态。

源码和完整执行日志可由[来源提交](https://github.com/ximu3/kisaki-w00-ci/tree/b87c1238e68846f25b46ec63d454a4ba83b85b18)及[CI 运行](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40310558001)核对。各架构、发行版、桌面入口与完整更新流程的结果按所属验收记录。
