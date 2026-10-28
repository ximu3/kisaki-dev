# 工程终态一致性审查

工程目录实际共 15 篇；排除 conventions.md、documentation.md、README.md 后，已全文审阅其余 12 篇，并交叉核对前轮已全文读取的 architecture.md 与 communication.md，共 14 项。逐篇范围和结论见 [engineering-coverage.json](engineering-coverage.json)。

本轮开始时只读；主代理随后明确授权修订既定合同冲突和明确过程叙述。工程修改 9 篇，不改变 API、工具版本、平台支持、签名或发布授权。音量与扫描换行规则另按用户明确确认闭合，见 [领域报告](domain-ui-review.md)。

## 已闭合

- integrations.md 的媒体接入将文件 AnimeSession 结束、播放器执行者最终关闭与显示 NativeFrame 释放分别表达。换文件可以复用 Mpv；screenshot-raw 的独立 bytes 不持有显示 NativeFrame，显示帧只按 allReferencesReleased 归还。
- network.md 按 architecture 的共同拥有层，通过 app 固定绑定交付偏好变化，由 network 完成采用。
- layout.md 的目录树、职责表与正文统一为 tools/desktop/package-inputs.ts、tests/desktop/consumers、support 和 fixtures；与实际文件、package.json、turbo.json 及 workspace 一致。跨项目 release 职责保留。
- 数据库迁移、原生能力、构建、协议、性能、工作区和接入说明去除 W00/W01/W03/W08/W13 排期、原型经过、已验证流水及旧工具清理历史。保留证据链接、正式验证边界、二十次启动采样、反馈预算及真实能力缺失的 null 语义。
- preferences.playback 的新文件初始化与当前实例保存/采用边界已补入 integrations；Mpv 核心复用不读取残留控制值充当产品初值。

## 保留的真实约束

临时开发远端、正式接续、仓库存档、版本 PR、首次 npm 身份与 token/OIDC、固定提交、发布临界区和不可变制品，是已有授权范围内的操作合同；未因出现“临时”“阶段”而删除。许可、权限、平台差异、恢复材料、不可回滚的外部结果以及未实测状态继续保留。

## 交主代理核对

repository.md 的最终仓库表（oauth-relay 行）写“建立独立私有仓库”，同篇 private-stage 的最后一段及 projects/oauth-relay/deployment.md 的源码交付则按“源码公开”表述。五个临时开发仓库 public 已明确；最终 relay 的可见性须按既有用户授权统一，不能从临时阶段推断最终意图。本审阅者未修改该表，也未执行远端操作。

## 实施与证据边界

- Drizzle 设计范围为 1.x，现有依据包含 0.45.2 查询试件与 1.0.0-rc.5 ORM/Kit 候选组合；本轮在应用 manifest 与 catalog 未找到正式 ORM/Kit 依赖。完整 schema、codec、迁移资源、版本组合及正式查询性能仍须由实际接入验证，不能把历史探针扩张为已实装。文档改为链接依据和完整验收要求，没有宣称选定了另一版本。
- integrations 移出的 Windows 图形、截图和缩放试验经过仍由原证据保存。未执行新的 GPU、Node 原生绑定、Electron 图像或六目标运行。
- 独立扩展额外许可正文及随包权利材料属于正式交付条件；本轮不起草新授权、不改变第三方许可，也不据设计映射宣称全部发行材料已齐全。
- 新音量/静音能力与九项扫描预设尚无对应产品运行实现；本轮完成的是正式合同闭合。扫描文档表达式的小探针单独报告，不等同于扫描/Worker/UI 验收。

`git diff --check` 在领域、UI 与工程范围通过；未运行全仓格式或长测试，没有提交、推送或发布。主代理统一维护实施状态并归档正式新证据。


## 汇总闭合

用户已确认 oauth-relay 最终仓库公开，repository.md 已同步。构建身份随后按用户确认改用 Turbo 任务定义，布局、任务环境与开发监听由主审统一修订，最终验证见本目录 README。
