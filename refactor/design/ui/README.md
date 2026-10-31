# 界面与交互

界面遵守[终态实现与整体一致性](../../../CONVENTIONS.md#final-state)及[简洁与原生准则](../../../CONVENTIONS.md#simplicity-native)，让用户用熟悉的方式直接完成任务。系统能力、控件语义和有意义的平台差异沿[共同交互规则](components.md#native-interaction)落实。

理解界面时先读共同交互与视图状态，再查具体浏览或导航场景；信息组织、名称与说明遵守[可读性准则](../../../CONVENTIONS.md#readability-principle)。

| 文档                              | 主要责任                                                 |
| --------------------------------- | -------------------------------------------------------- |
| [共同界面](components.md)         | 文案、组件组合、关闭确认、表单校验、Tooltip 与唯一反馈。 |
| [公共 UI 包](package.md)          | Kobalte 接入、组件家族、Field 与 TextField、源码和公开入口。 |
| [视图状态](state.md)              | 局部查询、编辑草稿、保存基线与加载。                     |
| [导航与入口](navigation.md)       | deeplink、通知激活、侧栏、快捷键、系统集成和完整退出。   |
| [Explorer](explorer.md)           | 分组浏览、混合选择、当前项、详情定位与返回。             |
| [展示柜](showcase.md)             | 查询区块、十项预设、编辑和完整读取。                     |
| [虚拟化与重排](virtualization.md) | 几何、显示实例、拖拽意图及保存边界。                     |
| [本地化](localization.md)         | 译本、ICU 消息、类型化参数和语言回退。                   |
