# UI 包样式与浏览器接入依据

2026-11-06 在本地 Windows x64 的隔离工程、浏览器和 Electron 窗口中核对以下机制。记录用于[UI 包设计](../../../design/ui/package.md)与[Webview 接入](../../../design/extensions/webview.md#isolation)；正式组件、完整制品与目标环境由 W05 和实际宿主验收。

<a id="styles"></a>

## CSS Modules 与层叠

构建使用 Node 24.11.1、tsdown 0.23.0 和 @tsdown/css 0.23.0。TypeScript 入口导入 button.module.css 并导出其中的 root 类名；配置使用合并输出 styles.css，局部类名模式为 `kui_[name]_[local]_[hash]`。输入包含以下普通 CSS：

```css
@layer components {
  .root {
    color: var(--foreground);
    border-radius: var(--radius);
  }

  .root[data-variant='primary'] {
    background: var(--primary);
  }
}
```

实际输出的 JavaScript 类名为 `kui_button-module_root_I535Iq`，独立 styles.css 使用相同选择器，并保留 CSS 变量、状态属性和 components 层。JavaScript 输出只包含类名映射，不运行 DOM 样式注入。

在 Playwright 1.64.1 的 Chromium 156.0.8078.4 中，将该 CSS 与测试宿主规则同时加载，两边先声明 `@layer theme, base, components, utilities`。组件的 primary 背景设为 `rgb(100, 100, 100)`，宿主 utilities 层使用单类选择器覆盖背景；结果如下：

| 输入 | 实际结果 |
| ---- | -------- |
| UI CSS 在前，宿主 utilities 在后 | 背景为宿主的 `rgb(1, 2, 3)` |
| 宿主 utilities 在前，UI CSS 在后 | 背景仍为宿主的 `rgb(1, 2, 3)` |
| UI CSS 与宿主未分层普通 CSS | 背景为宿主的 `rgb(4, 5, 6)` |
| 三种组合中的共同变量 | 文字为 `rgb(10, 20, 30)`，圆角为 `4px` |

这是局部类名、独立 CSS 和普通层叠覆盖的基础验证，宿主 utilities 为手写的等价规则。多入口归集、真实 Tailwind 消费、资源路径、完整声明与 tarball 仍按[公共包验收](../../scenarios/engineering.md#public-consumers)执行。上游 [CSS 支持](https://tsdown.dev/options/css)仍标为实验性，采用固定组合并按实际消费核对升级。

<a id="forms"></a>

## iframe 原生提交与 CSP

使用同一 Chromium，在两个不同 loopback 端口分别提供宿主和 iframe 文档。子文档通过响应头施加 `default-src 'none'; script-src 'self'; form-action 'none'`，脚本从该文档来源的独立文件加载。表单包含 required 文本输入、submit 按钮和本地 POST 接收地址；逐次建立新页面，比较 sandbox、默认提交处理和 novalidate。

| 条件与动作 | submit 次数 | invalid 次数 | 其他观察 |
| ---------- | ----------- | ------------ | -------- |
| allow-scripts、allow-same-origin；有效输入点击提交 | 0 | 0 | sandbox 在提交事件前终止处理 |
| 再加 allow-forms；处理器取消默认提交 | 1 | 0 | submitter 为保存按钮 |
| 同上，改为输入框按 Enter | 1 | 0 | submitter 仍为保存按钮 |
| allow-forms；处理器不取消默认提交 | 1 | 0 | 收到 form-action CSP 违规事件 |
| allow-forms；直接调用 form.submit | 0 | 0 | 收到 form-action CSP 违规事件 |
| allow-forms；required 输入为空，使用自动交互校验 | 0 | 1 | valueMissing 为 true |
| 同上，表单使用 novalidate，处理器取消默认提交 | 1 | 0 | valueMissing 仍为 true |

所有用例中原文档保持，本地 POST 接收地址取得的请求总数为 0。结果支持允许原生提交事件、由表单统一反馈，同时使用 CSP 限制默认提交目标。依据为 [HTML 提交顺序](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-submission-algorithm)与 [CSP form-action](https://www.w3.org/TR/CSP3/#directive-form-action)。正式 kisaki-extension 协议、私有 IPC 和真实宿主释放由[Webview 场景](../../scenarios/ui.md#webview-isolation)验证。

<a id="modal"></a>

## 模态范围与提示交互

另在 Electron 45.0.0、Chromium 156.0.8078.48 的隔离窗口中，比较 body 上的提示按钮、外部 manual Popover、Dialog 内的 manual Popover 与嵌套 Dialog。窗口启用 sandbox、contextIsolation，关闭 nodeIntegration；数据目录独立。

外部提示即使设置很大的 z-index，也不能在原生模态打开时取得焦点；外部 Popover 同样受模态范围限制。Dialog 内的 Popover 按钮可以聚焦，打开嵌套 Dialog 后焦点保持在内层，关闭内层后回到原 Popover 按钮。

跨来源 iframe 中的原生 Dialog 可以打开并进入 modal 状态，但只约束子文档，宿主按钮仍可聚焦。结果支持按实际文档与模态容器组织 Toast 展示区域；普通表单、reset、Select 和 Dialog 的其他原生基线见[原生 UI 记录](../native-ui/README.md)。
