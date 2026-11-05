# 桌面 UI 的设计验证

## Electron 原生表单与浮层

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

这些结果支持[公共 UI](../../../design/ui/package/README.md#ownership)采用原生表单与浮层。组件对受控值、键盘和焦点的接入由 W05 的仓库外消费者验收。

<a id="styles"></a>

## 普通 CSS 与图表色槽

2026-11-05，在 Windows x64 以 Vite 8.3.3 内存构建普通 CSS 入口，导入 W01 的 `/styles.css` 和 `kisaki-ui` 层中两个带 `ks-` 前缀的局部规则。用 Chromium 156.0.8078.4 在隔离页面读取实际样式，并挂载 Solid 1.9.16 与 Unovis 1.7.1 的官方分组柱适配。

- CSS 输出为一份 `styles.css`，已展开外观包导入。仅使用宿主 `.grid`、`.hidden`、`.flex` 类名的三个 section 在加载前后均为 `display: block`。将内容和框架基色设为 `#e8d8c8`、`#152535`，两块表面的实际背景分别为不透明的 `rgb(232, 216, 200)` 和 `rgb(21, 37, 53)`。同一页面上，已有按钮通过原生目标 ID 打开 Popover，Escape 将其关闭。
- 分组柱的五个合成系列按稳定键绑定第 1 至第 5 槽。仅显示第 4、第 1 系列并交换显示顺序后，两根柱仍取原槽。切到暗色并恢复全部系列后，五个 SVG 填色逐项等于暗色默认值。销毁 Solid 根后，容器内的 SVG 数为零。

试件验证[样式交付](../../../design/ui/package/styles.md#delivery)与[按系列键取色](../../../design/ui/package/chart.md)的可行性。正式控件、组合和全部交互随 W05 制品验收。
