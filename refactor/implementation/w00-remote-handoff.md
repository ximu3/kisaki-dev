# W00 验证仓库与正式仓库接续

W00 的跨平台验证先在临时私有仓库 [ximu3/kisaki-w00-ci](https://github.com/ximu3/kisaki-w00-ci) 中进行，旧公开仓库的存档与同名重建另行安排。临时库已于 2026-10-24 创建并核实为私有，当前正在准备首次提交与六目标运行。

## 当前状态

- 新工程位于 `F:/project/kisaki`，origin 指向临时私有仓库，本地 main 正在准备初始提交。W00 本机结果与根配置收尾见 [2026-10-24 记录](../verification/evidence/w00/2026-10-24/README.md)及[根配置复核](../verification/evidence/w00/2026-10-24/root-config/README.md)。
- 旧 `ximu3/kisaki` 仍是公开仓库，默认分支为 main；当前账户具有 admin 权限。它有 17 个 Release，附件约 0.8 GB，完整存档尚未进行。
- 新工程的六目标工作流已配置，本机 Windows x64 已实测；其余五个目标与远端 CI 运行结果仍缺。独立 ffprobe 已移除，媒体运行依赖由 libmpv-node 在接入工作包交付。

## 临时私有仓库

临时库使用独立名称 `ximu3/kisaki-w00-ci`，仅作为当前工程的私有验证环境。正式包名、appId、目标仓库身份和许可保持现行定义；临时库不承担 npm 发行、正式下载或网站部署。

GitHub 的[私有仓库标准 runner 列表](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job#standard-github-hosted-runners-for-private-repositories)包含当前六目标所用的 Windows、macOS、Linux x64／arm64 标签。实际启动前核实账户可用额度、存储和设置；[私有仓库用量受账户计划约束](https://docs.github.com/en/actions/concepts/billing-and-usage)，不自行购买额度或改动付费设置。

2026-10-24 已核实仓库 Actions 启用且允许当前工作流使用的 Actions。现有 GitHub CLI 令牌缺少读取用户计费信息的 user scope，额度 API 未取得结果；工作流沿用账户现有预算与付费设置，不把读取失败记作零使用或无限额度。

接续顺序：

1. 确定临时库名称，建立私有仓库；审阅源码、资源和记录，以 `chore: initial commit` 建立当前工程历史并推送。记录实际仓库和提交身份。
2. 从固定锁文件安装输入，直接执行六目标 CI，修复失败并保存构建身份、包与桌面制品、日志和运行证据。CI 使用同一版本的实际输入，不以临时库名称替代程序或包的身份。
3. 核对 W00 适用门槛并更新状态。跨平台结果属于记录的提交和制品，后续更改按实际影响重新验证。

Actions 产物有保留期。验证结果及资源归档须另行留存，不能把会过期的工作流附件当作永久输入。正式库准备好后，转交已验证的提交、归档和证据，核对文件摘要及新的取得路径，再决定临时库的归档或删除；临时库仍被使用时保留其输入。

## 正式同名仓库

正式 `ximu3/kisaki` 继续遵守[存档与重建规则](../design/engineering/repository.md#archive)，在明确执行授权后另行安排：

1. 在来源与新工程之外保存 Git refs／对象和实际 LFS、issue／PR 正文与评论／评审、Release 元数据及附件，以及实际存在的 Wiki、部署资料和有价值的本地未提交内容。用户资料、凭据和可重建缓存分别处理。
2. 验证存档完整且可读。源码和文件内容可从存档恢复，旧编号及全部 GitHub 平台状态不能保证恢复。
3. 删除旧远端并同名建立私有仓库，接续已经验证的新工程历史；配置协作、检查和实际发行身份。其他仓库、npm、域名和部署不随此动作改变。

临时库验证不要求现在执行第 3 项。正式仓库的保护、签署、公开发行和平台配置仍须在各自交付阶段验证。
