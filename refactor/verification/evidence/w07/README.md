# W07 应用运行与设置验证

验证范围见 [W07](../../../implementation/work-packages.md#w07)。2026-11-16 在 Windows 10 22H2 x64（10.0.19045）使用 Node 26.13.1、pnpm 12.18.0 和 Electron 45.3.2 验证。源码会话、真实窗口和打包制品分别使用用例拥有的资料目录。

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

工作区 `pnpm check`、desktop-contracts 与 desktop-localization 各自的制品及仓库外消费检查通过。桌面完整验证通过 5 项开发会话、23 项 Electron Node 模式、9 项真实 Electron、2 项性能和 1 项归档制品用例，并完成原生格式、Clippy 和绑定声明核对。20 次新进程启动使用保留的隔离资料和暖磁盘缓存，中位数为 722 ms，P95 为 782 ms。存储测量期间窗口到 main 的 IPC 往返 P95 为 2.41 ms。

本轮隔离候选版本为 `0.1.0-dev.0`，buildId 为 `a1f7e3a4-7be9-4771-a291-9b83aa041293`。实际解包运行的 Windows x64 ZIP 的 SHA-256 为 `4efbac3d76f6aa9747a3e0ab006fcba137e423e7581c227f243baf5fcf939eab`。NSIS 和 ZIP 均完成打包，启停与便携运行证据来自 ZIP。

Windows arm64、macOS 与 Linux 各架构的本轮结果待取得。系统登录项实际获准、协议登记与系统通知投递也须按对应平台、载体和隔离账号记录。
