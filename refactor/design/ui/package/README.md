# 桌面公共 UI 包

`@kisaki3/desktop-ui` 为桌面窗口、Solid 扩展页面和独立的 Solid 1.9 工程提供带 Kisaki 默认外观的控件。作者按家族导入组件，并在文档入口加载一次成品样式。

```tsx
import { Button } from '@kisaki3/desktop-ui/button'
import { Popover } from '@kisaki3/desktop-ui/popover'
import '@kisaki3/desktop-ui/styles.css'
```

<a id="ownership"></a>

## 作者可以组合什么

普通控件直接接受适用的原生属性、内容和事件。作者通过主题、尺寸、变体和根元素的 `class` 调整外观。页签与面板、菜单项、对话框内容与动作等有独立用途的部件可以分别组合。每个公开部件说明自己的语义元素、值、事件和焦点责任。

浏览器拥有表单、文本编辑和原生顶层呈现。组件管理本实例的临时交互、可访问关系和资源。宿主提供业务数据、已选模式、草稿、请求结果与动作，决定何时提交或保存。条目选择、部分日期编辑、资料卡片和业务确认流程归应用的 domain-ui 或具体扩展。

desktop-appearance 提供框架无关的[视觉词表和默认值](../../domains/appearance.md#tokens)。组件消费文档中的呈现值。主题登记、字体资源、文档外观采用和跨窗口协调分别由[桌面外观](../../domains/appearance.md#view)与宿主负责。Solid 是 peer 依赖，公共包间的依赖方向见[工程工作区](../../engineering/workspace.md#packages)。

<a id="families"></a>

## 按能力消费

| 使用场景                     | 公开家族子路径                                                                                             | 合同                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 执行动作、导航与基础呈现     | `/button`、`/link`、`/badge`、`/separator`、`/spinner`、`/progress`、`/alert`、`/image`、`/empty-state`    | [呈现与状态](controls.md#presentation)                |
| 填写和提交表单               | `/field`、`/input`、`/textarea`、`/checkbox`、`/switch`、`/radio-group`、`/select`、`/combobox`、`/slider` | [表单值与选项](controls.md#forms)                     |
| 切换模式、导航面板和组织内容 | `/segmented-control`、`/tabs`、`/collapsible`、`/table`、`/scroll-area`                                    | [内容与导航](controls.md#navigation)                  |
| 弹窗、菜单与反馈             | `/dialog`、`/popover`、`/menu`、`/tooltip`、`/toast`                                                       | [触发、关闭和焦点](overlays.md)                       |
| 展示数据                     | `/chart`                                                                                                   | [图表、系列与色槽](chart.md)                          |
| 编辑和呈现 Markdown          | `/markdown`                                                                                                | [编辑、资源与安全呈现](markdown.md)                   |
| 人工排序                     | `/drag`                                                                                                    | [移动语义与 Solid 接入](../virtualization.md#reorder) |

确认对话框属于 `/dialog`，下拉菜单和上下文菜单属于 `/menu`。拖拽家族提供稳定控制器、源与目标登记、自动滚动、手柄、插入线及辅助技术反馈。真实对象、选择范围、落点就绪和保存结果归宿主。需要虚拟化的视图直接使用 [TanStack Virtual 的几何能力](../virtualization.md#geometry)。

<a id="organization"></a>

## 源码与公开入口

每个控件家族就近维护 TSX、Props 和自己的 CSS。普通控件用一份 TSX 直接作为构建入口。多个 TypeScript 模块协作的家族通过本目录的 `index.ts` 选择公开接口，内部模块直接引用实现。构建配置显式映射家族入口，package.json 的 exports 指向 ESM、声明和公开样式。入口与组织遵守[源码分工](../../engineering/conventions.md#module-imports)。

共享行为按调用方需要的同一保证提取。例如焦点导航可以寻找下一个可用项，移动后是否激活由页签、菜单或分段选择分别决定。编辑事务、图表实例和可跨行卸载的拖拽过程各有自己的寿命，按完整能力组织。依赖从这些能力指向实际需要的基础控件。

目录树按维护位置列出文件，同一目录的文件写在同一行。源码职责随工作包交付，包的使用说明由 [W23](../../../implementation/work-packages.md#w23) 编写。

```text
clients/desktop/packages/desktop-ui/
├── package.json, LICENSE, README.md
├── .attw.json, tsconfig.json, tsdown.config.ts, eslint.config.ts, turbo.json
├── config/
│   ├── typescript/     tsconfig.lib.json, tsconfig.tools.json, tsconfig.tests.json
│   └── vitest/         consumers.ts
├── release-notes/<version>/  en.md
├── tools/              build.ts, clean.ts
├── src/
│   ├── styles.css, base.css
│   ├── internal/       form-reset.ts, text-editing.ts, focus-navigation.ts
│   ├── components/
│   │   ├── alert/               view.tsx, styles.css
│   │   ├── badge/               view.tsx, styles.css
│   │   ├── button/              control.tsx, styles.css
│   │   ├── checkbox/            control.tsx, styles.css
│   │   ├── collapsible/         disclosure.tsx, styles.css
│   │   ├── combobox/            index.ts, control.tsx, listbox.tsx, styles.css
│   │   ├── dialog/              index.ts, modal.tsx, confirmation.tsx, styles.css
│   │   ├── empty-state/         view.tsx, styles.css
│   │   ├── field/               view.tsx, styles.css
│   │   ├── image/               view.tsx, styles.css
│   │   ├── input/               control.tsx, styles.css
│   │   ├── link/                anchor.tsx, styles.css
│   │   ├── menu/                index.ts, dropdown.tsx, context-menu.tsx, surface.tsx, items.tsx, styles.css
│   │   ├── popover/             surface.tsx, styles.css
│   │   ├── progress/            view.tsx, styles.css
│   │   ├── radio-group/         control.tsx, styles.css
│   │   ├── scroll-area/         viewport.tsx, styles.css
│   │   ├── segmented-control/   control.tsx, styles.css
│   │   ├── select/              control.tsx, styles.css
│   │   ├── separator/           view.tsx, styles.css
│   │   ├── slider/              control.tsx, styles.css
│   │   ├── spinner/             view.tsx, styles.css
│   │   ├── switch/              control.tsx, styles.css
│   │   ├── table/               elements.tsx, styles.css
│   │   ├── tabs/                index.ts, root.tsx, list.tsx, panel.tsx, styles.css
│   │   ├── textarea/            control.tsx, styles.css
│   │   ├── toast/               view.tsx, styles.css
│   │   └── tooltip/             hint.tsx, styles.css
│   ├── chart/          index.ts, containers.tsx, legend.tsx, tooltip.tsx, styles.css
│   ├── markdown/       index.ts, editor.tsx, commands.ts, toolbar.tsx, preview.tsx, render.ts, editor.css, preview.css
│   └── drag/           index.ts, controller.ts, handle.tsx, indicator.tsx, styles.css
└── tests/
    ├── consumers/      solid.test.ts
    ├── support/        consumer.ts
    └── fixtures/consumers/solid/
        ├── package.json, tsconfig.json, index.html, entry.tsx, host.css
        ├── form.tsx, reading-layout.tsx, actions.tsx, states.tsx
        └── activity.tsx, note.tsx, order.tsx
```

<a id="delivery"></a>

## 制品和运行范围

库面向满足桌面 Chromium 能力基线的浏览器。普通 Solid 工程可从 tarball 直接使用所有家族和[成品 CSS](styles.md#delivery)。基础按钮只加载自身所需模块，图表和 Markdown 等较大依赖可以随功能入口加载。其他浏览器和 SSR 的支持按实际证据声明。

[W05](../../../implementation/work-packages.md#w05) 验证家族实现、键盘与焦点、视觉状态和实例释放。仓库外样板按[公共包消费场景](../../../verification/scenarios/engineering.md#public-consumers)检查同一份制品的依赖和完整声明，在实际 Chromium 中执行[公共控件组合场景](../../../verification/scenarios/ui.md#public-controls)。正式窗口及扩展页面随各自工作包验收。
