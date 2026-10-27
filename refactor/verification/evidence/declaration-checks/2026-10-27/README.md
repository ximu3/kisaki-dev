# 声明检查分工采用

用户确认采用“常规开启，公共消费者和自有声明拥有层关闭”。判断依据与同项目的两种选项测量见[必要性复核](../../monorepo-review/2026-10-27/skip-lib-check.md)，正式规则归[工作区规范](../../../../design/engineering/workspace.md#declaration-checks)。

共同 TypeScript 基线保持 strict 及既定源码选项，skipLibCheck 改为 true。公共包仓库外消费者继续显式使用 false；应用 main、shared、renderer 类型项目保留 false，分别覆盖原生 binding.d.ts、构建全局 build.d.ts 与窗口 environment.d.ts。原有结构检查沿真实脚本与项目引用，确认每份自有声明都有不跳过声明检查的执行拥有者。

UI 的 tsdown 配置并回已有 Node 工具类型项目，删除仅为旧声明豁免存在的 tsconfig.config.json 及其引用。工程指令、贡献指南、共同配置说明和正式规范同步，历史验证记录保留原范围。

本机 pnpm check 通过：50 项类型及依赖任务、54 项 lint／边界及依赖任务和 48 项常规测试，见 [check.log](check.log)。其中已包含自有声明完整检查的覆盖验证。八包重新打包后，publint、ATTW 及两项仓库外真实消费者通过，四份消费者类型配置继续使用 skipLibCheck: false，见 [consumers.log](consumers.log)。没有为此次类型分工改变再做本机性能、原生或最终制品回归。

同轮修正 Linux CI 中监听 fixture 关闭后删除临时目录的 ENOTEMPTY：先等待 Vite close，再使用 Node fs.rm 自带的有限重试处理瞬态目录错误，与现有开发工作区清理方式一致。超过重试次数仍失败，不更改生产生命周期或取消任何断言；Linux 结果由后续 CI 复验。前一轮完整记录见 [CI 40448497245](../../w00/2026-10-27/ci/README.md)。
