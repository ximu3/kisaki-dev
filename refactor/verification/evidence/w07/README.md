# W07 应用运行与设置验证

验证范围见 [W07](../../../implementation/work-packages.md#w07)。源码会话、真实窗口和打包制品分别使用用例拥有的资料目录，运行版本为 Node 26.13.1、pnpm 12.18.0 和 Electron 45.3.2。

## 运行与资源

| 场景 | 核对结果 |
| --- | --- |
| 任务历史 | 有结果检查点的执行遇到终态保存失败时，已进入的等待者和事实订阅者得到实际失败及完整结果。随后重读显示最后持久化的结果、interrupted 和未知结束时间。筛选、计数和清理使用相同判断。 |
| 任务控制 | 撤回尚未生效的暂停、在安全点暂停、取消等待、释放观察及取消实际任务分别验证。取消交付 Cancelled，终态控制返回已经形成的结果。 |
| 偏好保存 | 按字段核对基线，冲突时整次回滚。更新缩放保留同组损坏的主题原值。窗口保存后立即采用缩放，重载文档仍读取保存值。 |
| 图片与字体 | 真实 ICO 准备与 PNG 旋转、裁剪通过。编辑器释放图像后，已接纳的保存持有独立占用，附件随引用事务提交。字体从实际 WOFF2 解析可变字重，库记录删除后仍持有的字体文件可以继续读取。 |
| 受控读取 | 两个 Session、同一 Session 的两个视图分别验证。范围读取交付准确的 206、Content-Range 与字节。释放一个视图后其 URL 失效，其他绑定继续读取。 |
| 宿主网络 | 回环服务和认证代理验证了流式上传、单次消费、显式 Cookie、两条独立的 Set-Cookie、重定向及在途正文取消。新路由采用失败后，宿主与浏览器都拒绝新的网络访问。 |
| 浏览器 WSS | 在专用 Session 中为回环端点核对测试证书。切换代理后，原连接收到了新的消息，新握手到达了新代理。随后注入无效路由，已有连接继续接收消息，新握手未到达代理。行为见[网络合同](../../../design/engineering/network.md#webview)。 |

## 窗口与制品

视觉和操作依据取自对照工程 `F:/project/3/kisaki` 的标题栏、侧栏、任务中心及设置代码（检出提交 `e311fe7c`）。主窗口保留顶部窗口控制、侧栏底部固定工具和左下角应用菜单。任务中心使用 Dialog，进行中与已结束分开浏览，详情关闭后回到原筛选和触发按钮。偏好使用当前合同规定的分组草稿。

四类原生文档通过各自的沙箱 preload 与窗口 RPC 建立连接。真实窗口用例使用合成的完成记录及中断记录，按名称筛选、查看结果并返回。向字体编辑器拖入测试文件时，可以先预览再保存，重开仍可读取。另从偏好进入主题管理，保存并选用主题，再返回继续编辑或放弃原偏好草稿。资料库业务页面在 [W08](../../../implementation/work-packages.md#w08) 接入同一框架。

源码会话从 `src` 构建，在专用 profile 中执行迁移、显示窗口并正常停止。打包验收按收据核对归档、包内文件摘要与 Electron fuses。全新资料首次启动从部署目录加载原生绑定和迁移。默认关闭转入后台；结束隔离实例后设置关闭偏好，重新启动后正常退出。再将已退出的测试资料转入载体旁的便携目录，用不同的普通资料偏好核对下次实际采用的位置。

## 复验入口

`pnpm check` 运行工作区基础检查。以下命令从仓库根目录执行：

```sh
pnpm exec vp run @kisaki3/desktop-contracts#verify
pnpm exec vp run @kisaki3/desktop-localization#verify
pnpm exec vp run --concurrency-limit 1 @kisaki3/desktop#verify
```

指定已有候选时，以 `KISAKI_ARTIFACT_RECEIPT` 选择收据，再运行 `pnpm exec vp run @kisaki3/desktop#test:artifacts`。各目标的完成情况由[实施状态](../../../implementation/status.md#progress)登记。

## Windows x64 实测

2026-11-17 在 Windows 10 22H2 x64（10.0.19045）通过工作区 `pnpm check` 和桌面完整验证。5 项开发会话、23 项 Electron Node 模式、10 项真实 Electron、2 项性能和 1 项归档制品用例通过，原生格式、Clippy 和绑定声明一致。系统字体来自 DirectWrite，本机单次读取 185 个不同字体族约用 2 ms。主题编辑器选用系统字体后正常保存和退出。

20 次新进程启动采用保留的隔离资料和暖磁盘缓存，中位数为 623 ms，P95 为 674 ms。存储负载期间窗口到 main 的 IPC 往返 P95 为 2.12 ms。本机制品版本为 `0.1.0-dev.0`，buildId 为 `48f61a04-8a56-4cdd-a8a7-78538d7f428a`。NSIS 和 ZIP 均完成打包，启停与便携运行使用 SHA-256 为 `a52ba0f604a5ceab60f513f63c8071a8f3f27a644a04829f2df20030259f9f8e` 的 ZIP。

<a id="six-targets"></a>

## 六目标开发制品

2026-11-17，提交 `bd644b16` 的六个原生目标均通过完整桌面验证和制品启停。Windows 实际运行 ZIP 中的程序，macOS 运行从 ZIP 解出的 .app，Linux 运行 AppImage。各目标均从空资料创建数据库，重开后读取已保存的关闭偏好，再验证便携资料。Linux 使用 Xvfb 和 Openbox，macOS 与 Windows 使用 runner 的原生窗口会话。[CI 矩阵](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511)

表中启动时间来自每个宿主的 20 个新进程，IPC 为完整存储负载期间从窗口到 main 的往返时间。构建身份与文件摘要由实际运行制品的用例输出在对应作业中。

| 原生宿主 | 启动中位数 / P95（ms） | IPC P95（ms） | 实际运行归档的 SHA-256 |
| --- | ---: | ---: | --- |
| [Windows Server 2025 x64 · 26100](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511/job/133809207362) | 658 / 680 | 3.29 | `aa27ad8e6badca388db38c5a5626a67dba38a5d0d45b4ee810a2244d281e3ffa` |
| [Windows 11 arm64 · 26200](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511/job/133809207438) | 670 / 782 | 3.60 | `f3594d240d59beaac9973e8652f6743dd388ca24928cb2e03b59a261fd04e19f` |
| [macOS 15.7.9 x64](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511/job/133809207440) | 1568 / 1926 | 6.21 | `9776d9ec7276837660bf259ce005dd07f62a6d6105bc27f4ec87c3fe51a31792` |
| [macOS 15.8.2 arm64](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511/job/133809207515) | 739 / 1021 | 9.47 | `f9834012080a33e53943e3b9bc7b9bd2d234d7a9a47d09f624142cd7d9e8e67e` |
| [Ubuntu 22.04.5 x64 · X11](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511/job/133809207403) | 692 / 715 | 5.32 | `e940408648aa14b37f367cc3721cc0137e0f3a135acdead46bb7794df8ec368c` |
| [Ubuntu 22.04.5 arm64 · X11](https://github.com/ximu3/kisaki-dev/actions/runs/44014501511/job/133809207374) | 588 / 602 | 4.36 | `56c25770569d825d637252af63bf2ec4122eccecccc2a0c1ad5fcc763155d418` |

Windows 与 Linux 双架构在一次性账号中从系统集成界面登记并撤销登录项，随后由操作系统打开 `kisaki-dev://view/tasks`，并在已运行的窗口确认任务中心出现。Linux 双架构还在独立 D-Bus 和 X11 会话中由 dunst 激活真实通知，接收方得到发出通知时指定的任务目标。

上述登录项用例核对登记状态，重新登录后的后台自启与系统许可变化仍待实测。macOS 登录项登记、正式安装身份下的协议关联和系统通知投递仍需在对应安装环境核验。当前通知目标留在运行进程内，应用完全退出后从通知恢复目标的接入与实测仍待完成。
