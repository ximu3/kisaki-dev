# Electron 原生 UI 能力

2026-11-01，在本地 Windows x64 的 Electron 45.0.0、Chromium 156.0.8078.48 中，通过隔离窗口的真实 DOM 核对原生表单、Dialog、Popover 和可定制 Select。输入与观察范围如下，原始值见 [results.json](results.json)。

| 输入与操作                                             | 实际结果                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| required Select 选择非空值，再切换为空值               | 有值时表单有效，空值时无效。                               |
| 修改 Select、Checkbox 与 Range 后执行 form.reset       | 分别恢复默认选项、勾选与数值；FormData 与显示状态对应。    |
| 阻止 reset 事件                                        | 当前选项保持。                                             |
| 禁用 fieldset                                          | 后代匹配 disabled，FormData 为空。                         |
| showModal 后尝试把焦点移到外部                         | 焦点保持在模态内容中。                                     |
| requestClose 的 cancel 事件被阻止，再次正常关闭        | 第一次保持打开，第二次关闭后焦点回到触发器。               |
| 显示与隐藏 auto Popover                                | 收到对应 beforetoggle 状态；打开可取消，关闭事件不可取消。 |
| Select 使用 appearance: base-select 与 selectedcontent | 实际样式为 base-select，选中内容呈现为 Alpha。             |
| 查询 CSS 与 DOM 能力                                   | 支持 anchor-name、closedBy、requestClose 和 Popover。      |

这些结果支持[公共 UI](../../../design/ui/package.md#ownership)采用原生能力的技术基线。它们验证原生 DOM，Solid 受控状态、复杂选项、组件组合、输入法和全部目标环境继续由 W05 的正式实现验收。
