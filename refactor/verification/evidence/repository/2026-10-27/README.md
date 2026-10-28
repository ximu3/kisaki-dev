# 开发仓库公开可见性

2026-10-27，用户要求开发仓库全部改为 public。GitHub 连接器与当前 ximu3 账户的仓库清单均确认：本项目组当前只创建了 `ximu3/kisaki-dev`，四个独立项目的开发仓库尚未建立。名单见 [development-repositories.json](development-repositories.json)。

通过 GitHub CLI 将 kisaki-dev 从 private 改为 public，并将描述同步为 “Development repository for the Kisaki rewrite.”。随后未附认证信息的 GitHub API 请求成功读取该仓库，返回 `visibility: public`、`private: false`。仓库 ID 1432214248、main 默认分支和未归档状态保持原值，原始前后结果见 [visibility-before.json](visibility-before.json) 与 [visibility-after.json](visibility-after.json)。

按既有[协作合同](../../../../design/engineering/repository.md)，公开后同时采用 GitHub 原生 `pull_request_creation_policy: collaborators_only`，PR 功能保持启用。设置变更与读回结果见 [pull-requests-before.json](pull-requests-before.json) 与 [pull-requests-after.json](pull-requests-after.json)。

变更前对本地可达的 21 个提交检查了常见 GitHub／AWS 凭据格式和私钥头，未检出匹配；这是一项限定范围检查，不等同于完整秘密审计。仓库规范、独立项目说明、工作包与开发指南同步采用公开开发仓库。既有历史证据保留当时的 private 状态；本次未创建其他仓库，也未执行包发行或服务部署。
