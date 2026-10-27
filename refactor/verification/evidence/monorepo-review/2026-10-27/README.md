# Monorepo 与 CI 完成度核对

结论：Kisaki 已具备现代 monorepo 的工程基础，并实际使用 Turbo 的任务图、并行、缓存和受影响任务选择；当前版本的远端工程验收尚未全部闭合。上一轮“测试收敛实施完成”不能扩展为“工程终态已经完整验证”。

## 已成立的工程结构

- 一个 pnpm workspace、一份锁文件、固定 Node／pnpm 与共享 catalog。实际登记 45 个成员，另有根工程；分类目录不是包。
- 应用、八个公共包、33 个扩展与三个私有工程包有明确归属。公共包通过构建后的 exports 消费，工程共享通过私有 workspace 依赖与 exports；没有旧 paths 旁路或空 build。
- 项目脚本拥有实际工具调用，根入口统一调度。Turbo 使用 `^build`、明确的跨包任务依赖、transit、输入与输出声明；类型检查、包构建等有限任务可复用缓存，现场运行任务实际执行。
- 当前 CI 使用原生 affected 查询分别选择任务，保留完整入口、未知基线回退、必需检查汇总和六目标矩阵。GitHub 原生 cache 保存 Turbo 本地缓存，按系统、架构及 Node 版本隔离。

这些安排符合 [Turbo 工作区结构](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)、[任务配置](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)与[缓存规则](https://turborepo.dev/docs/crafting-your-repository/caching)的核心模型。没有使用每项可选功能不构成缺陷；Vite、Electron 生命周期、原生资源和制品流程仍由各自拥有者管理。根桌面测试入口负责准备，应用测试脚本消费准备结果，这一分工在贡献指南中明确说明。

## 本次发现并修正的遗漏

1. **打包输入不完整。** packager 实际读取应用 `electron-builder.yml` 并复制根 `LICENSE`，上一轮收窄后的 package／test:artifacts inputs 未列入两者。真实 Turbo dry-run 确认缺失，可能使仅修改这些文件时漏选制品验证。现已补入两项任务，并在原有隔离 Git 选择测试中覆盖两种修改。
2. **任务环境未完整声明。** 实际计划使用 Strict Mode，而 package 的 env 为空，项目要求的 `KISAKI_MAC_SIGNING_IDENTITY` 无法沿根 Turbo 入口交给 packager。现已按任务声明签名身份及 `MACOSX_DEPLOYMENT_TARGET`；有限构建、开发和开发测试明确保留原生目标变量，开发内层公共包构建所需的 `TSDOWN_*` 也继续传递。保持严格过滤和打包禁用缓存，没有读取或使用签名凭据。

环境处理依据 [Turbo 严格环境规则](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables#strict-mode)。签名身份参数可传递只证明工程接入已声明，不等于已经完成真实 macOS 签署、首开或更新验收。

前一项是上一轮收窄引入的遗漏，后一项此前已经存在。旧 CI 的完整测试矩阵不能发现全部声明缺口；尤其历史 macOS 候选为 test-only，没有消费正式签名身份。

## 之前的 CI 是否达标

历史 CI 已具有固定安装、实际依赖构建、原生／Electron 宿主区分、六目标运行、成品观察和必需结果汇总。[旧提交的六目标完整运行](../../w00/2026-10-25/sequential-workflows/ci/README.md)确实通过，证据继续有效。

但按当前已确认的“按实际影响验证、控制重复成本”要求，上一轮之前的 CI 尚未充分达到：只有一个 desktop 选择结果，选中后全部桌面套件一起运行；通用浏览器在六目标重复，消费者无条件运行，普通变化和完整性能验收混在同一组条件中。Turbo 当时已有实质作用，任务级选择和 CI 分工仍不够充分。之前确认可运行与覆盖通过，不应被表述成工程质量已无缺口。

## 本轮验证与剩余范围

本轮通过源码、实际 workspace 清单、当前配置、旧 CI 与已有证据核对，并读取 Turbo 2.11.10 的真实任务计划。没有重新制造运行失败、打包或执行签名。

- 原有两项任务图用例通过，受影响选择现覆盖十二类修改；任务计划同时核对环境声明，见 [task-inputs.log](task-inputs.log)。
- 根类型检查、修改用例 ESLint、配置与测试的 Prettier，以及 git diff --check 通过。
- 上一轮已通过的宿主与消费者证据保持其原范围，不因本次任务声明修改机械重跑。

W00 仍需当前版本的新六目标 CI 结果，以及 GitHub 跨运行缓存恢复证据。此前的[本机冷／热缓存、上游失效及输出恢复](../../w00/2026-10-26/monorepo-cache/README.md)不能替代后者。

实际项目身份签署最终制品、签名完整性、独立环境首开及跨版本更新验签属于 [W11](../../../../implementation/work-packages.md#w11)，不作为 W00 当前完成门槛。W00 负责现有工程入口的参数传递、必需签名的失败规则、测试制品标识，以及可执行的验证入口；没有要求在此阶段取得正式签名制品或完成发行验收。完整业务按所属后续工作包推进。本轮没有提交、推送、发布或部署；当前状态见[实施状态](../../../../implementation/status.md)。
