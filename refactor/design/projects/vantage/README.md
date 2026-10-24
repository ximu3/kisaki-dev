# Vantage

Vantage 是外部程序观察与交互库，公开包为 `@ximu3/vantage`。进程和窗口是并列目标，前台是环境事实，采集图像是操作结果。

| 主题                                                     | 内容                                               |
| -------------------------------------------------------- | -------------------------------------------------- |
| [公共 API](api.md)                                       | 入口、实例引用、快照、观察、控制、采集、错误与授权 |
| [平台后端](backends.md)                                  | 系统范围、身份保证、Windows／macOS／X11 机制       |
| [Linux 桌面接入](linux.md)                               | GNOME／KWin 组件、协议、采集与宿主登记             |
| [Kisaki 接入](../../engineering/integrations.md#vantage) | 游戏监测与完整操作的业务归属                       |

本项目适用[原生库运行与交付](../native-runtime.md)，设计依据收于[验证记录](../../../verification/evidence/README.md#vantage)。

<a id="source"></a>

## 源码与运行职责

Rust core 的一层模块按实际职责命名：

| 模块        | 唯一责任                                                           |
| ----------- | ------------------------------------------------------------------ |
| processes   | 进程查询、真实实例识别、生命周期观察，以及明确的退出与强制终止操作 |
| windows     | 窗口查询、归属、状态与控制，以及指定窗口采集和图像结果的持有       |
| foreground  | 环境前台快照与持续观察，保留进程／窗口各自已知的部分               |
| observation | 初始快照与后续观察接续、订阅停止与中断，以及真正共用的观察资源     |
| platform    | 目标操作系统与当前桌面环境的具体实现                               |

这些模块服务 processes、windows、getForeground 与 observeForeground 四项公开入口。公共不透明引用与过去快照沿既定合同处理；平台编号只能作为本次可核对的信息，不能成为重新指向其他实例的捷径。

窗口采集及其图像结果属于 windows 的内部职责，不把一个采集结果类型单列成根级能力。observation 承担进程、窗口和前台三处实际共用的观察规则；某个后端独有的监听细节仍留在相应平台模块。

platform 下按 windows、macos、linux 组织。每个平台模块承接相同的进程、窗口和前台语义，并按系统事实安排自己的实现。共同的数据与校验由其真实拥有者提供，平台代码直接复用相应规则。

Linux 的进程能力与桌面接入分开：普通进程查询和生命周期观察可以在没有显示服务器时使用；窗口、前台、聚焦和采集按实际 X11 或 Wayland 会话接入。GNOME／KDE 所需的桌面组件放在 integrations/linux/gnome-shell 与 integrations/linux/kwin，拥有自己的源码、版本对应、安装说明和集成测试，作为 Vantage 的交付组成部分。

    vantage/
    ├── crates/core/src/platform/linux/   Rust 侧 Linux 后端与协议接入
    └── integrations/
        └── linux/
            ├── gnome-shell/             GNOME Shell 中运行的组件
            └── kwin/                    KWin 中运行的组件

两个目录分别保存加载到 GNOME Shell／KWin 环境的组件及其原生包结构。Rust 侧的协议接入位于 core 的 platform/linux；源码路径中的 linux、gnome-shell 和 kwin 分别说明平台与宿主。构建和部署流程管理生成安装包及最终系统路径，各项目按实际组件设置源码目录。

桌面组件负责必须在桌面环境中完成的访问，Rust 后端负责协议接入与真实窗口引用的对应。实际连接、组件协议、版本登记与最终制品装配按[Linux 桌面接入](linux.md)实现。组件失联或重启时报告相关观察中断，旧引用不自动绑定新实例。普通查询不安装组件、触发授权或换成另一种计时含义；需要用户配合的前置条件由明确入口呈现。

Node binding 将 Rust 结果转换为公开值、关联观察回调并完成相应环境退出清理。原生实例与状态由 Rust core 管理；Kisaki 拥有监测集合、暂离计时、窗口选择和退出后备份。

正式实现与联合消费按[验收场景](../../../verification/scenarios/vantage.md#vantage)核对。
