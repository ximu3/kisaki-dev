# oauth-relay 构建输入与运行交接验证

对应[构建与部署细化](../../../design/projects/oauth-relay/deployment.md)。本轮没有访问账号或重复真实 OAuth 核验，只读取官方公开发行材料，在独立缓存中运行 Compose 解析器及固定 Node 子进程。

## 输入

| 项目           | 实际取得与核对                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Compose        | 官方 5.6.0 Windows x64 单文件程序，下载后按同一发行 checksums.txt 核对 SHA-256                      |
| Node           | 官方 24.22.0 Windows x64 ZIP，按 SHASUMS256.txt 核对后只取 node.exe                                 |
| Hono / adapter | 复用未经修改的 4.13.13 / 2.1.5 固定包，入口摘要与此前输入一致                                       |
| 基础镜像       | node:24.22.0-trixie-slim 的 OCI index 与 linux/amd64、linux/arm64 子 manifest，按摘要读取；未下载层 |
| 配置数据       | example.invalid 镜像地址、无秘密应用 JSON 与程序自有字面值；未读取真实部署环境或 Docker 登录配置    |

[prepare.py](prepare.py)与 [source-input.json](source-input.json)保存版本、来源、实际路径、归档摘要和镜像清单。本轮基础 index 摘要为 a6155384446670e9719bdc4fd0ebe4d4b29fb32a8d6aa523da3547a6cfbcf22c。匿名 registry 访问令牌只用于读取公开 Node 清单，没有保存进证据。

## Compose 解析

[compose.py](compose.py)使用隔离 DOCKER_CONFIG、仅供测试的环境变量和不可用的专用 named pipe 地址运行官方 CLI；解析没有调用 Docker 引擎。检查 [compose.yaml](compose.yaml)展开后只有一个 relay 服务，镜像引用固定，JSON 只读挂载、create_host_path:false、宿主 loopback 地址、目标 3000 端口、独立探活与 30 秒停止宽限均保留。

[runtime.example.env](runtime.example.env)中的值都是虚构输入，包含美元符号、引号、注释符号、空格与反斜线。format:raw 的解析模型保留原值；移除 raw 的对照有两项被改变。结果见 [compose-contract.json](compose-contract.json)。该检查没有验证容器内实际环境变量或挂载权限。

初始检查直接把导出 JSON 与未转义值比较，发现 CLI 将 `$` 输出为 `$$`。固定版 [config.go](https://github.com/docker/compose/blob/v5.6.0/cmd/compose/config.go)明确在正常 config 导出时执行这一处理。比较随后采用对应的输出规则，应用本身仍按普通环境变量读取原值，不增加额外解码。真实秘密不应进入公开的 config 展开结果。

## Node 停止交接

[lifecycle.mjs](lifecycle.mjs)在候选 Node 上启动两个独立 Hono 子进程，分别验证正常完成与超过期限的上游请求。父进程使用自己的 loopback 上游；重复发出关闭请求，两次都复用同一次清理。

| 场景     | 结果                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------- |
| 正常完成 | 请求返回 200；78ms 收尾，未触发强制期限；活动请求／任务为 0，监听关闭，进程退出码 0                       |
| 超过期限 | 100ms 试件期限后取消真实上游 HTTP；117ms 收尾，客户端连接结束；活动请求／任务为 0，监听关闭，进程退出码 0 |

最初正常完成场景到 1000ms 仍触发了退出期限。核对 Node 固定源码后，收尾增加了响应结束时的空闲连接回收，避免开始关闭时仍在响应的连接随后继续等待 keep-alive。最初脚本及断言观察保存在 [initial-observations.json](initial-observations.json)，最终记录见 [lifecycle-contract.json](lifecycle-contract.json)。没有更改 Node 或 Hono 源码，也没有用延长测试期限掩盖这个收尾条件。

该试件在 Windows 通过 IPC 进入同一个 shutdown 函数。它没有执行 POSIX SIGTERM、Linux PID 1 或 docker stop；正式容器仍需验证这层交接。100ms 和 1000ms 是试件期限，不替代已确认的生产 25 秒应用期限与 30 秒容器宽限，也不作为性能承诺。

## 蓝本和范围

[Dockerfile](Dockerfile)、[.dockerignore](.dockerignore)与 [.env.example](.env.example)说明未来独立仓库的构建和运行输入。Dockerfile 面向正式工程的 manifest、锁文件、源码及 tools；当前没有把本仓库或隔离试件包装为正式 relay 镜像，没有执行镜像构建。

本轮结果只证明其记录的构建输入、配置语义和 Node 生命周期条件。实际镜像、发行平台、容器内权限、秘密注入、真实代理与运行服务切换没有执行。既有两来源授权结果继续引用[原始核验](../oauth-relay-provider/providers.md)，不属于本轮网络活动。

复核入口：

```powershell
python refactor/verification/evidence/oauth-relay-delivery/compose.py
```

Node 生命周期试件使用 source-input.json 中已核对的 node.exe 执行 lifecycle.mjs；不替换本机全局 Node 或 pnpm。[verification.py](verification.py)核对已保存输入、原始结果与初始观察的摘要，结果见 [verification.json](verification.json)；它不会重新运行原生试件、启动容器或访问账号。
