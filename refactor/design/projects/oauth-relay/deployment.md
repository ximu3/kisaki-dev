# oauth-relay 构建与部署

构建、配置、容器、关闭和最终部署遵守本页约定。用户令牌不进入持久服务状态。

<a id="delivery"></a>

## 构建、部署与关闭

项目正式交付固定依赖的容器镜像、根目录 compose.yaml、配置示例和部署说明。Dockerfile 负责把 Node 程序构建为镜像；compose.yaml 负责该镜像的运行配置、网络、挂载、重启与停止策略。两者与唯一的 Node 服务入口协作，不在容器中加入另一套进程管理器。

| 文件                | 责任                                                              |
| ------------------- | ----------------------------------------------------------------- |
| Dockerfile          | 使用锁定依赖完成构建，运行阶段只保留程序及生产依赖，直接启动 Node |
| .dockerignore       | 从构建上下文排除本机依赖、Git 数据、真实配置、环境文件和秘密材料  |
| compose.yaml        | 引用明确版本或摘要的镜像，配置一个 relay 实例及其真实运行输入     |
| .env.example        | 镜像标识、端口、配置路径等 Compose 参数示例，不填写真实秘密       |
| config.example.json | 应用注册、权限、回调和秘密环境引用的无秘密结构示例                |
| docs/deployment.md  | Compose 首次配置、启动、更新、回退、代理接入、日志及关闭验证      |

这些文件放在项目根目录，直接供 Docker 构建与 Compose 使用。完整 Compose 配置由实际文件保存，部署说明引用该入口并解释操作。以后出现独立代理配置等配套资源时，再按其实际内容组织目录。

生产 compose.yaml 消费已经构建并验证的镜像，通过明确版本或摘要固定输入，不在服务器每次启动时重新编译源码。Dockerfile 同时供 CI 和本地构建使用，镜像中的 Node 程序仍是同一个源码入口。具体基线、双架构目标与镜像组织见[细化方案](#inputs)；镜像发布位置仍由正式发行确定，不能将官方基础镜像的存在写成 relay 镜像已经可用。

Compose 的 .env 参数插值与容器环境分别处理。真实应用配置由宿主以只读文件方式挂载；秘密按照既定的环境引用合同，通过明确的 environment 或受控私有 env_file 注入容器。实际秘密文件由部署端保管，源码目录只维护无秘密示例；不将秘密写入镜像构建参数、镜像层或提交的 Compose 文件。应用不因为宿主存在 .env 就假定所有变量已经进入进程。

Compose 运行单个 relay 实例，健康检查使用服务自身探活入口，停止宽限与 Node 收尾期限配合。端口、TLS 和代理接入按实际部署环境配置，relay 镜像交付自身服务。短期授权状态只存于运行内存，容器重建后按既定规则失效。

Node、Hono 与 adapter 的实际版本在依赖核验时锁定，不用框架示例的最低 Node 版本作为生产运行基线。源码采用普通 ESM，运行依赖从锁文件安装。tools 拥有构建、配置检查、镜像装配和消费验证，CI 调用相同流程，并用无秘密测试输入检查 Compose 配置及实际容器运行。docs 维护独立服务自身的 HTTP 协议、应用登记、来源差异及部署说明；release-notes 遵守技术项目的[英语基准与按需译文](../../engineering/releases.md#notes)。

服务以一个 Node 执行实例运行，授权会话由该进程内存持有。容器、worker 与进程管理配置都须保持这一单实例约束。改变实例数量前，需要重新确定会话状态与路由合同。

server 收到关闭信号后停止接纳新工作，等待已接受请求在明确期限内收尾，超时则取消本进程持有的上游工作并释放 HTTP 资源与短期状态。关闭与重新启动可能使未完成授权失效，不能声称无状态滚动替换对授权过程完全透明。

探活使用独立运维入口，只判断服务自身配置与运行状态，不调用上游授权或 token 接口，也不展示应用秘密和会话内容。源码公开、发布制品和运行服务切换分别验证；设计确认不表示现有运行服务已经切换。

<a id="deployment"></a>

## 部署入口与健康检查

生产 Compose 使用已经验证的固定版本或摘要镜像，运行一个直接启动 Node 的实例。配置与秘密之外没有授权状态持久卷。GET /healthz 是自身探活入口：就绪返回 200 和 status:ok，停止接纳后仍能到达应用的请求返回 503；监听关闭后不承诺返回 HTTP 响应。不返回应用清单、秘密、会话数，也不探测上游账号。

默认容器停止宽限为 30 秒，大于上述 25 秒进程收尾期限。实例正常重启会使未完成授权失效；刷新仍按客户端持有的上游令牌处理。镜像构建、反向代理、TLS、访问日志脱敏及实际应用清单需要在目标部署完成核验。构建和退出的完整执行规则见下文。

<a id="inputs"></a>

## 版本与基础镜像

生产选择受支持的 LTS 系列，具体 patch 版本和基础镜像摘要进入构建输入；不在每次构建时追随 latest。构建基线采用 Node 24.22.0，依据为[官方发行索引](https://nodejs.org/dist/index.json)与[维护阶段说明](https://nodejs.org/en/about/previous-releases)。后续版本调整通过明确变更及相应检查完成，不把设计日期当作永久版本保证。

基础镜像固定为 node:24.22.0-trixie-slim，多架构 index 摘要为 sha256:a6155384446670e9719bdc4fd0ebe4d4b29fb32a8d6aa523da3547a6cfbcf22c。构建与运行阶段使用同一带摘要引用。amd64 与 arm64 的子 manifest 及来源核对见[输入收据](../../../verification/evidence/oauth-relay-delivery/source-input.json)；镜像运行另按下述制品验证执行。

Hono、adapter 与编译工具分别由独立仓库的 manifest、packageManager 和 pnpm-lock.yaml 规定。冻结安装、类型检查、测试和镜像启动使用同一确定输入。不把本机 Node 或全局包的版本默认为容器输入。

<a id="build"></a>

## Node 程序构建

独立仓库采用普通 TypeScript 编译到 ESM JavaScript，build 的稳定入口为 pnpm run build，产出 dist/server.js 及其模块和 source maps。类型检查与编译发生在构建阶段，运行镜像不安装编译器、执行安装脚本或从源码临时启动。普通相对导入与 package type 保持 Node ESM 的实际规则。

| 镜像阶段                | 输入与责任                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- |
| tooling                 | 固定 Node 基础镜像与 pnpm 版本，提供构建工具                                          |
| build                   | 冻结安装完整项目依赖，调用项目 build 入口，得到 dist                                  |
| production-dependencies | 从同一 manifest 和锁文件只安装生产依赖，形成独立运行依赖图                            |
| runtime                 | 从原基础镜像取得 Node，复制 dist、生产 node_modules 与 package.json，以 node 用户执行 |

两次安装各自服务构建与运行的依赖图，运行阶段不直接复制包含开发工具的 node_modules，也不依赖对未使用包是否留在缓存中的猜测。[Dockerfile 蓝本](../../../verification/evidence/oauth-relay-delivery/Dockerfile)给出具体路径与阶段；正式服务按同一职责形成自己的可构建源码与镜像。

进程以 exec form 启动 Node，SIGTERM 到达这个 Node 进程，容器内不加入 pnpm start、shell 循环或另一套进程管理器。node 用户及相应文件权限来自[官方基础镜像](https://github.com/nodejs/docker-node/blob/main/24/trixie-slim/Dockerfile)，运行配置仍由外部只读挂载，不打入镜像。信号接入与入口形式见 [Dockerfile 规范](https://docs.docker.com/reference/dockerfile/#entrypoint)。

构建只复制明确需要的 manifest、锁文件、TypeScript 配置、src 和 tools；[忽略规则](../../../verification/evidence/oauth-relay-delivery/.dockerignore)同时排除本机依赖、输出、真实配置、环境文件与秘密材料。实际项目若新增构建所需资产，必须明确加入构建输入，不能用 COPY 整个工作目录吸收部署端数据。

<a id="compose"></a>

## Compose 运行输入

正式项目根目录交付 compose.yaml、.env.example、config.example.json 与 docs/deployment.md。[Compose 样本](../../../verification/evidence/oauth-relay-delivery/compose.yaml)提供结构参考，样本地址 example.invalid 在发行时替换为实际已验证镜像。解析结果与执行环境保留在验证记录中。

| 输入               | 唯一用途                                                       |
| ------------------ | -------------------------------------------------------------- |
| RELAY_IMAGE        | 已构建、验证的 relay 发行镜像引用；部署按摘要固定              |
| RELAY_CONFIG_FILE  | 宿主上的实际应用配置 JSON，挂载到 /etc/oauth-relay/config.json |
| RELAY_ENV_FILE     | 宿主上的私有运行环境文件，注入配置所引用的秘密环境变量         |
| RELAY_HOST_PORT    | 暴露给实际反向代理的宿主端口，默认 3000                        |
| RELAY_BIND_ADDRESS | 宿主绑定地址，默认 127.0.0.1                                   |

随附 Compose 使用容器内 3000 端口，和应用默认 listen 一致；部署端主要调整宿主端口。若部署者改变容器内部 listen，必须同时调整 Compose 目标端口及探活地址，不让两份配置互相覆盖。配置文件需要能由运行镜像的 node 用户读取，秘密环境文件则只需由宿主上的 Compose 进程读取。

JSON 使用 bind 的长形式、read_only 与 create_host_path:false。缺少配置文件时不应隐式创建同名目录；正式启动核对实际挂载与权限。[绑定挂载语义](https://docs.docker.com/reference/compose-file/services/#volumes)

私有 env_file 使用 format:raw。值按字面写在等号后，不额外加仅用于 dotenv 解析的包装引号；真实值本身包含的引号仍是值的一部分。Compose 的项目 .env 继续承担普通参数插值，两种文件不能交换职责。raw 需要 Compose 2.30.0 或以上。[原生 env_file 规则](https://docs.docker.com/reference/compose-file/services/#env_file)

raw 环境文件保留 `$`、引号、`#` 与反斜线等字面字符。CLI 的 config 导出会将字面 `$` 写为 `$$`，供导出文件再次读取；程序直接使用容器中的实际环境值。解析差异与导出行为见[固定版实现](https://github.com/docker/compose/blob/v5.6.0/cmd/compose/config.go)。

实际部署用 config --quiet 检查，不把展开后的 config 输出复制到工单或 CI 日志。完整展开对照只用于自有虚构输入；应用自身的配置错误继续只给出安全字段路径与变量名。

<a id="shutdown"></a>

## 停止接纳、请求收尾与退出

进程只有一个可重复调用的 shutdown 工作。SIGTERM、SIGINT 与服务自身的关闭入口调用它；重复信号不创建第二次清理。进入关闭阶段先停止接纳新业务，再停止 HTTP 监听，等待已接纳的请求完成，最后清理短期授权状态与运行资源。

健康检查只访问自身 /healthz。正常就绪为 200；仍能到达应用的关闭期请求为 503，监听已经关闭后不再承诺返回 HTTP 响应。等待浏览器回调的内存会话没有正在运行的 HTTP 工作，不为它们等待完整 600 秒授权窗口；重启后它们按既定合同失效。

Node 的 server.close() 会处理调用时已空闲的连接，但当时仍在响应的连接可以稍后才进入 keep-alive。关闭阶段在响应 finish 后调用 closeIdleConnections，回收新变为空闲的连接；不在正常响应尚未结束时使用强制关闭。[Node 固定实现](https://github.com/nodejs/node/blob/v24.22.0/lib/_http_server.js)、[HTTP 关闭接口](https://nodejs.org/docs/v24.22.0/api/http.html#serverclosecallback)

服务默认等待 25 秒；到期则取消仍由本进程拥有的上游请求、关闭剩余 HTTP 连接并完成清理。客户端无法取得结果时仍按结果不确定处理，停止不触发 token 重放。默认 Compose stop_grace_period 为 30 秒，给应用自己的清理留出时间；若调整应用关闭期限，也须保持外层宽限更长。Docker 默认先发 SIGTERM，宽限后才强制终止。[停止语义](https://docs.docker.com/reference/compose-file/services/#stop_grace_period)

Compose 根据容器退出和 unless-stopped 策略处理重启，healthcheck 报告当前健康状态。relay 将上游暂时故障作为相应请求结果处理，并继续服务其他请求。重启行为见[Docker 策略](https://docs.docker.com/engine/containers/start-containers-automatically/)。

<a id="release"></a>

## 制品验证与部署

CI 从固定提交冻结安装、检查与构建，生成两个候选平台镜像，分别运行配置装载、HTTP 合同、健康检查和真实停止测试。测试用虚构接入和受控上游，镜像中不注入维护者的应用秘密。通过的同一镜像摘要才进入发行清单，不重新构建一份未经检查的“发布镜像”。

项目发行材料包括镜像摘要与平台清单、源码提交、Node／pnpm／依赖输入、Compose、配置示例、英语说明及所提供译文、第三方材料。镜像发布位置作为该发行的明确输入，由 RELAY_IMAGE 消费；发布前核对实际镜像仓库与推送权限，不发布占位镜像。

切换时先准备新配置与目标镜像，在目标环境用独立测试接入核对，然后按已确认的单实例方式替换运行实例。回退使用先前已验证的镜像摘要及与之相容的配置；不恢复上一次进程的授权会话，也不承诺升级对正在授权的用户完全透明。实际域名、TLS、代理、访问日志和已登记应用清单仍在切换前核对。
