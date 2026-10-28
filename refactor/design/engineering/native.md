# 本体私有原生能力

本页规定桌面本体自维护原生能力的工程、消费、类型、运行和交付边界。各项能力在同一规则下提供可直接消费的 Node 接口，应用负责产品流程与宿主接入。Vantage、libmpv-node 等独立项目继续按各自已确立的规范交付，本体通过其公开包消费。

先使用 Node、Electron 和现有依赖能够完整提供的能力；私有绑定只补足实际缺口，如不覆盖移动或平台要求的同步原语。增加 Rust 实现须能说明所需语义或已测得的收益，不将“原生优先”理解为把已有标准能力重新写成原生模块。

<a id="ownership"></a>

## 工程与职责

clients/desktop/app/native 是桌面应用内部的私有原生工程，采用 Rust、Node-API 与 napi-rs。它由应用 workspace 管理 Node 侧依赖和任务，由自己的 Cargo manifest、锁文件和工具链文件管理 Rust 构建，随本体版本交付。当前每个目标生成一个原生绑定，能力在工程内部按职责组织。

| 拥有者              | 职责                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| native/src          | 系统调用、平台差异、原生资源与 Node-API 绑定。按能力组织实现，绑定只处理实际的语言、值和环境边界。 |
| native/node         | 本体消费的 Node 入口、公开类型、错误、绑定加载和必要的 TypeScript 适配。                           |
| main/infrastructure | 消费原生能力，完成应用需要的技术组合、宿主转换和设施生命周期。                                     |
| main/app            | 解析部署环境与资源路径，显式加载并注入所需能力，协调应用启动和退出。                               |
| main/features       | 产品策略、业务操作、持久记录、用户交互和失败后的业务决定。                                         |
| app/tools/native    | 原生构建、声明生成与核对、目标制品装配及输出完整性检查。                                           |

原生工程不导入本体 features、数据库、窗口或扩展合同，不根据作品、备份阶段或用户偏好决定行为。main 是其运行消费者；preload、renderer、extension-host 和 shared 不导入私有原生实现或绑定。跨进程接口由本体所属能力定义，只交付该接口允许的值。

<a id="layout"></a>

## 源码与入口

```text
clients/desktop/app/
├── native/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── rust-toolchain.toml
│   ├── src/
│   │   ├── lib.rs
│   │   └── files.rs
│   ├── node/
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   ├── binding.d.ts
│   │   └── files.ts
│   └── tests/
├── tools/native/
└── tests/integration/native/
```

native 使用一个 Cargo crate；lib.rs 声明实际模块与原生导出，files.rs 是当前文件能力的实现。能力需要多文件协作时再拆为同名目录，平台实现归相应能力内部。crate 拆分依据独立职责、依赖和测试需要，不为每项能力建立一份原生工程。

node/index.ts 只列出实际公开导出，loader.ts 拥有加载入口，files.ts 拥有文件能力确需的 Node 适配。Node 源码遵守[TypeScript 要求](conventions.md#source-language)，纳入应用的类型检查、依赖检查和 main 构建，不另登记嵌套的 pnpm workspace 或独立 npm 发行项。

应用 package.json 的 imports 唯一定义 `#native` 入口，指向 native/node/index.ts，遵守[模块导入规则](conventions.md#module-imports)。main 与原生集成测试从该入口消费接口，原生模块内部使用相对导入。main/app 调用 `loadNative(modulePath)`，传入 app/paths 提供的绝对制品路径，取得按能力组织的接口，再向设施注入其所需部分。当前文件能力通过 `native.files.moveNoReplace(source, target)` 调用。设施直接使用该接口及其类型，不穿透绑定或重新实现加载；只有应用语义和宿主转换留在设施中。

入口导入不隐式加载二进制或创建系统资源，加载由装配显式发起。无状态操作使用普通方法；持有会话、观察或其他资源的能力按自己的合同创建和关闭实例，不要求所有能力具备同一套生命周期方法。

<a id="types-errors"></a>

## 类型与错误

底层绑定声明由实际 Rust 导出生成，保存为 node/binding.d.ts，作为可审查输入进入版本控制。原生构建重新生成并核对该声明；平台之间保持同一 Node 合同。TypeScript 检查直接消费声明，不为取得类型加载二进制，也不在消费方手写一份绑定接口。

Node 入口公开调用者需要的参数、结果、错误和资源类型。原生声明已经准确表达的类型直接选用；必要的 TypeScript 适配定义其新增的语义，公开声明由实际代码生成与检查。消费方从 `#native` 引用，不复制类型、建立同形别名或通过设施再次转导出。

加载失败与能力操作失败分别报告。加载器保留原始 cause 并提供安全错误；每项能力拥有稳定的错误类别、原因字段与必要上下文。系统错误码用于诊断和有依据的映射，调用者不解析错误文案。错误转换归原生工程的 Node 边界，业务层只补充实际业务含义或采取相应处理。

参数在所属语言和系统边界按合同校验。已建立的可信结构不逐层重复解析，平台实现仍负责系统调用所需的约束。无法兑现能力合同的平台、内核或文件系统按明确的不支持结果报告，不能暗中换成语义更弱的操作。

<a id="runtime"></a>

## 完成、取消与资源

每项能力说明输入与返回值、完成时机、失败后可能已经发生的副作用，以及适用的取消和释放规则。可能阻塞主线程的原生工作在工作线程或所属原生执行环境中完成；短时同步调用按实际合同声明，不能用 Promise 外形掩盖主线程上的阻塞操作。

取消区分尚未提交、已经接纳和系统调用已经开始。不可撤销的调用须等待实际结果，不能因调用者停止等待就报告已撤回。操作结果、订阅停止和资源释放分别以各自的完成条件交付。

持有原生资源的实例负责创建失败清理、正常关闭和环境退出。跨线程传递自有值或明确持有的资源，回调只属于创建它的 Node 环境；关闭后不再向失效环境交付。回调队列按实际负载保持有界，GC 不代替正常资源关闭或业务完成事实。无持久资源的能力不增加空的初始化和释放流程。

<a id="delivery"></a>

## 构建、加载与验证

app/tools/native 按[工具目录与工作流](layout.md#tools)提供本地与 CI 共用的实现，桌面任务按依赖调用。构建固定 Rust、napi-rs、Cargo.lock 和所需 Node-API 等级，记录源码、目标、工具输入和制品摘要。支持目标与最低环境沿[桌面构建合同](build.md#platform-testing)核对，Node-API 兼容不能替代系统 API 与实际 Electron 消费验证。

各目标的绑定放在 `out/<target>/resources/native/kisaki-native.node`，配套运行依赖保留在同一受管资源区域。Cargo 中间输出与运行制品分开，开发和不同目标输出各有唯一写入任务；main 构建只编译 Node 入口代码，不把 .node 当作 JavaScript 打包。最终安装包按原生加载要求外置或解包，app/paths 提供实际部署路径。

加载器只采用装配给定的制品及其声明的运行依赖，缺失或不匹配时明确失败。启动不现场编译、联网下载或搜索开发机的其他输出。Node 入口和原生制品属于同一次本体构建，打包流程核对二者的构建身份、目标与资源，实际加载和调用由对应集成及最终制品用例验证。

Rust 单元测试贴近所属模块，crate 集成测试位于 native/tests，遵守 Cargo 的发现规则。Node 适配的纯单元测试贴近 TypeScript 源码；应用 tests/integration/native 负责入口、声明、错误、真实绑定及适用的取消与环境清理验证，tests/tools/native 验证原生构建工作流。目录与样本归属遵守[测试结构](layout.md#tests)，运行环境与隔离遵守[测试要求](../../verification/acceptance.md#environments)。

验证同时覆盖原生规则、Node 消费边界、具体业务接入和最终六目标制品：类型消费不加载二进制，缺失或错误目标制品准确失败，操作行为与公开声明相符，适用资源在失败和退出时释放。各能力按相同分工覆盖自己的行为与应用装配。

<a id="files"></a>

## 文件能力：不覆盖移动

files 提供 `moveNoReplace(source, target): Promise<void>`，将文件或目录在同一文件系统内移动到不存在的目标。两个路径必须是绝对路径且不含 NUL。该方法在异步工作线程执行，成功只表示这次移动已经完成；读取、摘要核对、保护备份和恢复决定继续由文件设施与备份业务负责。

| 平台    | 明确采用的系统原语                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Windows | MoveFileExW 配合 MOVEFILE_WRITE_THROUGH，不设置 MOVEFILE_REPLACE_EXISTING 或 MOVEFILE_COPY_ALLOWED；目标存在或跨卷时失败。 |
| macOS   | renameatx_np 配合 RENAME_EXCL；目标卷不支持该语义时报告不支持，不回退到会覆盖的 rename。                                   |
| Linux   | renameat2 配合 RENAME_NOREPLACE；同时核对内核和目标文件系统支持，不以先 exists 再 rename 模拟原子性。                      |

平台映射依据 [Windows MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)、[Apple 声明](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h)和 [Linux rename](https://man7.org/linux/man-pages/man2/rename.2.html)。[Node rename](https://nodejs.org/api/fs.html#fsrenameoldpath-newpath-callback) 会覆盖已存在的文件，不能替代这里的合同。

Node 入口拥有 FileMoveError 及其 MoveFailureReason，按实际原生原因分别表达 targetExists、sourceMissing、crossDevice、unsupported、permissionDenied 和 ioFailure，并保留必要的系统错误码。设施直接消费这些定义。进入系统调用后不提供伪撤回或复制后删除的备用实现，业务等待实际结果并核对磁盘事实。

原语负责目标名称冲突，来源内容的一致性由[恢复流程](../domains/backups.md#restore)在移动前后核对。首次改动用户目标前，恢复流程使用同一工作区中的测试文件验证目标文件系统的不覆盖移动能力；不支持时保持用户目标原样并停止。单次移动成功不证明整段恢复事务或掉电持久性；目录项持久化和掉电行为分别验证，恢复材料按完整业务流程保留。

<a id="file-sync"></a>

## 文件能力：关键文件同步

files 提供 `syncFile(path): Promise<void>`，对本次明确指定的既有普通文件请求平台同步。path 为不含 NUL 的绝对路径；接口不创建、替换或截断文件，不把目录当普通文件处理。实际打开、同步与句柄关闭由同一次异步原生工作拥有，成功前须检查系统返回值并释放本次句柄。

| 平台 | 选定机制 |
| --- | --- |
| Windows | 以所需写入权限打开文件，使用 FlushFileBuffers；不打开卷或请求管理员权限 |
| macOS | 对普通文件使用 fcntl(fd, F_FULLFSYNC)，不把普通 fsync 成功等同于这项更强请求已完成 |
| Linux | 对普通文件使用 fsync(fd)，目录项另由文件设施按所属操作同步 |

Node 入口拥有 FileSyncError 与 FileSyncFailureReason，原因固定为 invalidArgument、pathMissing、wrongType、unsupported、permissionDenied 或 ioFailure，并保留适用的系统错误码。文件设施消费该错误；需要的同步机制不受支持时准确失败，不自动降为较弱操作后报告相同成功。已经进入系统调用后等待实际结果，取消不撤销已发同步。

该接口只确认指定文件的同步请求成功，不递归刷新目录树，也不证明每个设备已经正确兑现写入承诺。目录项、移动及与数据库的提交次序归[备份持久化](../domains/backups.md#durability)，各目标的文件系统和中断类型分别验收。依据见[Windows 文件同步](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)、[Apple fsync 与 F_FULLFSYNC](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fsync.2.html)及[Linux fsync](https://man7.org/linux/man-pages/man2/fsync.2.html)。
