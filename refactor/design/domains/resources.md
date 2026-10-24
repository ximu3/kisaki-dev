# 文件输入与资源访问

文件来源、保存后的业务身份和运行期读取各用不同的合同表达。FileInput 提供本次操作的输入，稳定引用标识已经保存的附件或文件，ReadResourceRef 与视图地址则控制当前运行期的读取。跨进程传递这些值时，必须保留它们的含义和真实调用归属。

<a id="input"></a>

## 文件输入与准备结果

共同输入和准备结果定义如下：

```ts
type FileInput =
  | { type: 'path'; path: string }
  | {
      type: 'url'
      url: string
      headers?: Readonly<Record<string, string>>
      redirect?: 'follow' | 'error'
    }
  | { type: 'bytes'; bytes: Uint8Array }
  | { type: 'resource'; resource: ReadResourceRef }

interface PreparedAttachment {
  readonly attachmentId: string
  readonly resource: ReadResourceRef
  dispose(): Promise<void>
}
```

FileInput 属于共同文件读取合同，不保存到正式资料字段。选择、拖入和粘贴只取得输入来源。浏览器 File 或 Blob 由接入层转换，不直接放入 JSON；路径及可读范围依据真实调用上下文核对。url 只支持 HTTP(S) GET 和必要请求头，并通过 network 执行。复杂认证、请求组合或解码应由 provider 先完成。

redirect 直接采用[宿主网络](../engineering/network.md#cookies-and-redirects)的 follow／error 语义，省略时为 follow，适用于公开资源。携带来源凭据的输入必须显式指定 error；提供非空 Authorization 或 Cookie 头时，文件读取边界在发出请求前核对该条件，头名称按 HTTP 规则不区分大小写，不满足时返回 InvalidInput。其他自定义凭据由来源适配按同一政策明确选择 error，宿主不猜测其账号含义。重定向被拒绝后，本次读取失败，不改成无凭据重试，也不将 error 转为 follow。

原图和缩略图各自的 FileInput 保留对应选项，图片／字体准备及跨进程传递不能丢弃 redirect。已准备资源按自身占用复用，不因后续预览再次访问来源。

bytes 用于调用方已经持有的内存内容。其他来源不应仅为传输方便而全部载入内存。请求头、原始字节和临时引用都不能进入持久资料或日志。

PreparedAttachment 表示已经取得、验证并保留，等待正式采用的内容。它预分配 attachmentId，通过 resource 提供当前预览，但尚未登记正式附件行。PreparedImage 和 PreparedFontFile 的技术信息由主进程检查实际内容后补充，调用方不能自行伪造。准备、采用与占用的生命周期见[附件](attachments.md)。

相关操作分别承担以下职责：

| 操作                  | 输入与结果                                      | 职责                                               |
| --------------------- | ----------------------------------------------- | -------------------------------------------------- |
| images.prepare        | FileInput → PreparedImage                       | 取得并验证图片，提供编辑所需资料和预览资源         |
| images.transform      | 已取得资源与处理参数 → PreparedImage            | 生成裁剪、旋转、翻转后的新图片                     |
| fonts.prepare         | FileInput → PreparedFontFile                    | 验证字体、解析技术资料，供保存前预览               |
| fonts.import / update | 文件输入、已准备文件或适用的已有文件引用 → Font | 保存字体记录与最终文件集合                         |
| 所属业务保存          | 最终字段、正文及采用的附件引用 → 所属业务结果   | 在同一事务中提交业务资料、所采用附件及实际引用关系 |

显式准备适用于预览、编辑草稿和撤销。普通 import 可以直接接收 name 和 files: FileInput[]，内部完成准备与保存；ingest 也可以自行组织步骤，不要求所有调用都拆成公开的多阶段流程。最终保存只采用实际使用的结果，编辑器则保留可撤销的内容直到编辑结束。复用正式附件时沿用 id，只有新的字节或明确重新导入才创建新结果。

<a id="addresses"></a>

## 稳定引用与受控地址

数据库和正文保存附件或文件身份，正文图片使用 `attachment:<id>`。主进程根据真实窗口或业务上下文建立读取范围，再返回 `kisaki-resource://<scope>/<resource>` 形式的内部地址。这个地址不持久保存，也不用作 deeplink。

协议通过 protocol.handle 注册到对应的 Electron session。业务决定对象可以在哪些范围使用，资源层只读取已授权内容。调用方不能凭附件 id、自报的窗口 id 或拼接 URL 扩大权限，读取任意本地路径。跨窗口打开业务内容时，应传递稳定引用，由目标窗口自行取得读取权限；交付已经取得的固定内容时，则使用 ReadResourceRef 重新绑定，不能转发旧窗口地址。

浏览器 scope 绑定实际窗口或视图，构成该上下文唯一的资源来源；同一视图的多个绑定以 resource 区分。宿主将这一精确来源写入页面和包内 Worker 的 CSP。

资源注册表核对绑定、内容和撤销状态，可取得 frame 信息时一并核对。URL、Origin、Referer 和 webRequest 只能提供部分接入信息。绑定失效后停止新读取，响应缓存遵守相同撤销规则；已取得内容按占用合同继续持有。Webview 接入见[来源策略](../extensions/webview.md#csp)。

<a id="views"></a>

## 将资源交付给视图

运行期资源与视图绑定使用以下合同：

```ts
interface ReadResourceRef {
  readonly id: string
}

interface ViewResourceBinding {
  readonly urls: Readonly<Record<string, string>>
  dispose(): Promise<void>
}
```

ReadResourceRef 由宿主发出，标识本次已经取得的具体内容，值中只携带受控读取引用。view.resources.bind 接收 `Readonly<Record<string, ReadResourceRef>>`，返回的 urls 保留输入键，目标由真实 view 句柄确定。稳定附件身份由附件合同另行管理。

绑定只交付已经取得的内容，不查询业务、不重新读取最新版本，也不处理图片或字体。资源模块因此无需依赖 UI。绑定成功后，目标视图独立占用同一份内容，原读取方可以释放自己的占用，不必复制文件。dispose 只释放该绑定的占用，其他视图继续使用。视图销毁时，宿主清理其剩余绑定。

Node 扩展持有带方法的句柄，私有 IPC 只传递资料和 urls。视图替换显示内容时，应协调释放旧绑定。正常应用外观由宿主直接交付，Webview 静态资源按 document.root 和 entry 加载，扩展作者无需手动绑定。上述资源能力用于运行期取得的内容。原生窗口使用同一底层机制，不必绕经扩展 Node 环境或模拟扩展视图。

<a id="lifetime"></a>

## 读取、取消与释放

图片、阅读页面等 Web 内容通过受控协议读取，mpv 等可信原生工具则使用主进程解析出的实际输入。归档成员只能在已经打开文件的授权范围内解析。资源访问不启动本机 HTTP 服务。

随机读取必须正确支持 Range、流和取消，大文件不能整体穿过 IPC。源内容修订后，旧请求不能静默返回新版本。关闭窗口、结束编辑或阅读、撤销 Webview 时，各自释放本范围的监听、句柄和临时解压内容，不能影响其他占用者。

迟到的取消结果不能覆盖用户的新选择。读取句柄失效后，由业务重新取得授权；协议层不自动续期，也不擅自换成其他目标。

<a id="failure"></a>

## 失败与恢复

不同失败按以下规则处理：

| 情况                           | 行为                                 |
| ------------------------------ | ------------------------------------ |
| 下载、处理或提交失败           | 保留原引用，收尾本次准备结果         |
| 派生缓存丢失或损坏             | 按实际来源重新生成                   |
| 正式附件字节丢失               | 保留引用并报告不可用，不清空图片字段 |
| 找回与记录校验值完全一致的字节 | 可修复原附件身份对应的字节           |
| 找回另一份图片                 | 作为新附件明确采用                   |
| 读取句柄失效                   | 由业务重新取得授权，不自动换资源     |

旧缩略图可以帮助用户辨认丢失的图片，但不能证明正式画质已经恢复。模型不增设图片版本、缓存变体或持久读取会话表。实际读取行为、跨窗口隔离和制品性能由所属功能的验收覆盖。
