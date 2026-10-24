# Kana 构建与发行

代码、类型、worker、WASM 与配套资产由同一构建产生，并按实际运行环境验证。

<a id="delivery"></a>

## 工具、资源与交付

worker 及专用适配放在实际拥有者旁边：PDF 接入归 formats/pdf，归档解码和内容转发 Service Worker 归 resources。共用 XML 语法模块随格式解析能力组织，Expat worker、桥接、本地标准实体目录及按需加载的 libiconv 转换资源放在该模块旁边；编码别名从固定构建生成。确需自有 worker 协议时，由相应模块管理；第三方 worker 按其实际入口装配。resources/zip-worker.ts 拥有归档及其范围读取／成员任务，以隔离 zip.js 的模块级配置和解码池；使用公开 external 入口，内层解码在该 worker 中执行。具体装配及 PDF 实例 worker 见[后端执行范围](#backends)。

包同时交付实际需要的脚本、声明、样式、PDF worker、Expat worker／Wasm、libiconv Wasm 与固定编码表、本地标准实体目录、字体／字符映射和解码资源。源码与构建输出分开；第三方资源从固定依赖准备到发行目录，保留来源和许可，不散落在示例与 Kisaki 工程中各复制一份。libiconv 的源码、CP932 差异、重建步骤和可替换资产接入随发行维护。运行不依赖 CDN 或消费者的开发机路径。消费方通过 assetsBaseUrl 指定资源部署位置，完整输入与消费验证见下文。

tools 拥有本项目实际的准备、构建、装配和制品检查流程，CLI 只承接参数；CI 调用同一流程。examples 使用公开包展示最小无框架阅读接入；tests/consumers 验证打包产物、声明以及浏览器构建消费，不通过跨仓库源码路径掩盖缺失导出和资源。纯函数测试可以邻近源码，真实布局和交互验证放在 tests/browser，格式样本及来源、许可和预期值放在 tests/fixtures。docs 保存公共合同及接入说明，release-notes 遵守技术项目的[英语基准与按需译文](../../engineering/releases.md#notes)。

<a id="assets"></a>

## ESM 包与资产部署

发布 ESM 包，保留主入口与 contracts 两个代码入口。另公开 assets 下的发行资源及资产清单，不开放 formats、view 等私有源码路径。纯入口从真实定义生成声明和脚本，不维护另一套为 Node 手写的公共镜像。

assetsBaseUrl 是必需的浏览器部署输入，指定以 / 结尾的同源资产目录。包随发行交付 reader 样式、内容转发 Service Worker、PDF worker、Expat 及本地实体目录、libiconv 转换资源和固定编码名数据、字符映射与字体。清单记录实际相对路径、包版本和校验信息，宿主构建按清单完整复制到自己的静态资源位置。按需加载由库根据实际格式与编码决定，调用方不另选 XML 解码后端。

显式部署输入使直接浏览器消费、Vite 和 Electron 采用同一合同。不能假设打包器会自动收集运行期拼接的资源目录，也不把 CSS、PDF worker 或 Wasm 隐藏为 CDN 依赖。Kisaki 使用自己的受控静态资源地址，库不依赖 Electron 的私有部署路径。模块导入不加载这些资源；打开文档后再按实际格式准备所需后端。

导入 contracts 的 Node 消费方不需要安装 DOM 类型、创建窗口或提供 assetsBaseUrl。声明包消费及局部资源交付机制已经运行；包内资产的正式复制、离线运行、CSP／worker 配置以及不同构建器消费仍须完整验证。

[资源加载与部署](resources.md)规定浏览器使用 HTTPS 或认可的本地安全上下文，同源部署专用作用域；Electron 的受控协议具有标准、安全、fetch 与 Service Worker 能力，并保持必要的同源 DOM 访问。缺少相关内容所需的资产或部署能力时以 assetUnavailable 失败，不自动改用另一套 Blob 改写路线。模块导入不登记 worker，实际需要时再建立或复用。

内容地址、读取与资源占用归本次 Reader，静态转发登记可以跨实例保留。Reader.close 不注销仍供其他实例或标签页使用的登记；登记不持有书籍字节与读取权限。上述条件细化资产部署和寿命，不新增公共资源宿主端口，也不改变输入类型或源位置。

内部字节交付采用已验证的原生可转移流，准备时核对实际能力和转发程序身份。并存的发行版本使用各自作用域，同页独立库副本分别路由；同域冲突明确失败，不替换其他程序。取消打开不发布迟到的内容地址，共享静态安装可按自身寿命结束；完整规则和证据见[资源执行与部署](resources.md#versions)。

<a id="package"></a>

## 代码、声明与资产版本

@ximu3/kana 仍只公开主入口、contracts 入口及 assets 资源路径。主入口提供浏览器操作；contracts 交付纯值、错误和确定性函数，脚本及声明从同一份真实实现生成。内部格式、布局和 worker 协议不成为可导入的公开子路径。

采用 ESM；两份入口分别拥有对应的 types 与 import 导出，assets 的实际文件和清单可由构建工具解析。Node 消费 contracts 时无需 DOM 环境或浏览器模拟，主入口的类型也不要求 Node 环境声明。模块导入只建立定义，不登记内容 worker、取得存储、读取文件或加载解码资源。

主入口不同时承载样式自动注入。reader 样式属于发行资产，由 view 在创建实际视图时采用；第三方字体和 CMap 等同样按所需后端加载。明确的 assetsBaseUrl 是唯一部署输入，不用打包器对动态 URL 的猜测代替资源准备。

发行流程从固定输入生成代码、声明和资产，打成一个待发布 tarball，再由独立消费者使用这份 tarball。Kisaki 正式依赖可取得的发行版本；私有联调使用固定提交生成的 tarball，不以跨仓源码 alias、link 或运行时下载填补缺失制品。发布使用通过验收的同一份文件，不临时重建另一份。

<a id="integration-assets"></a>

## 资产清单与依赖闭包

资产清单记录包版本、不可变资产身份，以及每个实际文件的相对路径、字节数和 SHA-256。身份覆盖这份发行需要的资源集合；清单自身不形成递归校验项。路径保留嵌套结构，不从 basename 汇总文件，也不只复制顶层 worker 而遗漏它的 import、Wasm 或数据文件。

| 资产组           | 随包内容                                                        | 实际拥有者与加载条件                      |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------- |
| 阅读呈现         | reader 样式、内容转发 Service Worker 及其静态依赖               | view 与 resources；实际需要内容文档时准备 |
| PDF              | 与主模块匹配的 PDF worker、Wasm、CMap、标准字体及其实际数据依赖 | formats/pdf；打开 PDF 后按所需能力准备    |
| ZIP              | Kana 的归档 worker、固定 zip.js 模块及实际解码 Wasm／数据       | resources/zip；归档输入按需建立           |
| XML              | Expat worker、桥接脚本、Wasm、本地标准实体目录                  | 格式共用语法能力；XML 输入使用            |
| 扩展 XML 编码    | libiconv 桥接与 Wasm、固定别名数据及已确认 CP932 差异           | 同一 XML 输入；仅扩展编码路径加载         |
| 格式与确定性数据 | 实际采用的 HTML／CSS 解析代码、字符与排序数据及来源记录         | 所属格式或转换模块；按真实代码拆分进入包  |

宿主构建按清单复制完整发行集合，验证目标中的路径、长度和摘要，再暴露资产根。内容资源保持同源、稳定路径和正确 MIME；JS／Wasm 请求不能被 SPA 的 HTML 回退页伪装成成功。运行时准备当前内容需要的后端并核对包与资产身份，不为打开一份 TXT 预热所有解码器和字体。

不同发行资产部署到不同的不可变目录。内容转发的专用作用域、程序身份、复用与退役沿[部署规则](resources.md#versions)执行；关闭 Reader 只结束自己的内容与读取，不移除共享静态登记。旧版本的活跃消费者结束后，部署拥有者才清理该版本自己的资产和登记。

<a id="backends"></a>

## 第三方执行范围与全局配置

### ZIP：归档拥有独立执行范围

zip.js 2.24.0 的 configure、解码池与 Wasm 状态由模块实例持有，同一模块中的 ZipReader 共享这些状态。workerURI／wasmURI 的修改与 terminateWorkers 的调用都作用于该模块实例，Reader 的执行范围按下述隔离方案组织。

由 resources/zip 为本次归档建立专用 worker，worker 使用 zip.js 的公开 external 入口，在自己的执行范围中固定资产地址。zip.js 的 useWebWorkers 为 false，因为整个归档工作已经位于该 worker；原生解压能力和随包 Wasm 的选择仍留在该后端。worker 不可用时按资产准备失败处理，不把归档同步解码移回界面线程。

这个 worker 拥有归档目录、成员读取和实际解码；其窄协议传递授权范围读取、成员任务、取消和释放，不成为公共接口或通用任务框架。宿主借入的 ByteSource 仍由 resources/access 持有，worker 按需请求字节；传输取得自己的块，不能分离借入源的缓冲。流和成员消费继续使用已有背压、占用与读取准入。

归档关闭先停止新工作、取消或结束成员读取，等待所属源请求收尾，再关闭 ZipReader、结束该执行范围的解码资源并终止 worker。中止某一成员不结束其他仍被消费的成员；强制结束 worker 时，父侧同样完成自己持有的读取与任务清理。worker 数量和并发成本归该 Reader 的资源预算。

### PDF：显式 worker 与资源参数

PDF 后端从当前资产根创建模块 Worker，以公开的 PDFWorker port 参数交给 PDF.js，再在 getDocument 输入中提供该 worker 和对应 CMap、标准字体、Wasm 地址。不在每次 openReader 时改写全局 workerSrc／workerPort，也不复用另一个 Reader 已经关闭的端口。

每份 PDF 的 loading task、文档与原生 Worker 由 formats/pdf 统一持有。已创建的外部 Worker 必须由自己的拥有者结束；不能只因为 PDFWorker 包装已销毁就假定外部端口已终止。具体入口已由固定 PDF.js 的公开声明核对，完整运行沿既有 PDF 适配实施，不以 ZIP 场景替代 PDF 验收。

### XML、字体和显示资源

Expat 的实例、解析结果和取消归本次 XML 工作，libiconv 保持独立、按需且可替换的转换资产。它们不与宿主的全局编码设置协商，也不因其他文档打开而更换已确定的字节解释。

应用提供的 FontResource 是本次 Reader 借入的资源，family／resource 选择与字体库记录分别拥有身份。接入在 Reader 的实际读取寿命内保留字体占用；失败时释放未采用的新准备，仍被使用的原资源继续有效。已注册字体、视图、canvas 和格式缓存分别按现有合同结束，不由“新偏好已保存”推定旧资源已无使用者。
