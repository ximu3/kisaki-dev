# 浮层、菜单与反馈

触发器、浮层内容和关闭动作按实际操作组合。已有工具栏按钮可直接控制 Popover，右键菜单可以绑定已有行，宿主对话框可以接收某个独立操作发出的关闭请求。各组件只接管自己打开期间需要的事件与焦点。

## Popover 与 Tooltip

Popover 使用原生顶层呈现，可通过外部点击或 Escape 关闭。调用方可以用同一文档内唯一的 ID 将已有按钮的 `popoverTarget` 关联到 Popover。这个按钮同时拥有动作名称、图标、尺寸和焦点。浮层定位到实际触发器，并在视口边缘调整位置。

```tsx
import { createSignal, createUniqueId } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Popover } from '@kisaki3/desktop-ui/popover'
import { SegmentedControl } from '@kisaki3/desktop-ui/segmented-control'

function ReadingSettings() {
  const id = createUniqueId()
  const [layout, setLayout] = createSignal('single')
  const layouts = [{ value: 'single', label: '单页' }, { value: 'double', label: '双页' }]
  return (
    <>
      <Button variant="ghost" popoverTarget={id}>阅读设置</Button>
      <Popover id={id} aria-label="阅读设置">
        <SegmentedControl aria-label="页面布局" items={layouts} value={layout()} onValueChange={setLayout} />
      </Popover>
    </>
  )
}
```

Tooltip 将补充说明关联到已有控件。悬停或键盘聚焦均可阅读，指针移入提示后继续显示，Escape 收起。截断文字与提示内容按[完整文字规则](../components.md#tooltip)选择。需要操作的内容使用 Popover。关闭和卸载时释放所属计时与监听。[HTML Popover](https://html.spec.whatwg.org/multipage/popover.html#the-popover-target-attributes)

## Dialog 与确认

Dialog 在宿主接纳打开状态后通过原生 dialog 进入模态顶层。标题或显式名称关联到模态内容，浏览器约束模态内的焦点。Escape、关闭按钮、允许的外部点击和 `method="dialog"` 提交都经过同一个可阻止的关闭意图。受控宿主可以同步阻止，待异步确认结束后再更新 open。Dialog 随已接纳状态完成关闭。普通业务表单保留自己的提交处理。

嵌套模态从最上层开始关闭，焦点随每一层返回发起位置。确认内容呈现对象、后果和可选动作，宿主指定适当的初始焦点，并决定动作结果与下一步状态。草稿检查、保存失败和窗口退出由[应用弹窗宿主](../components.md#closing)协调。拥有者销毁时释放该层资源。[原生 Dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) · [模态焦点](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## 下拉菜单与上下文菜单

下拉菜单从具名按钮打开并按按钮定位。上下文菜单绑定宿主已有的目标元素，右键在指针处打开，菜单键或 Shift+F10 在键盘目标处打开。宿主在发起操作时确定业务目标。

两个入口共用面板、菜单项、禁用与选中呈现、方向键浏览、首末定位和文字查找。打开时把焦点交给可用项，Enter 或 Space 激活动作。键盘取消时返回本次发起元素，外部点击关闭时尊重该次点击取得的焦点。宿主提供并更新实际选中值，负责动作产生的业务结果。[菜单按钮交互](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) · [菜单键盘行为](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)

## Toast

ToastRegion 属于实际显示通知的视图或对话框。宿主提供消息、紧急程度、动作、关闭文案和展示时长，同一条提示可就地更新。持续提示由宿主或用户关闭，定时提示在悬停或内部聚焦期间留给用户阅读。消息更新、关闭或卸载时收尾原有计时。通知通道和一次操作的反馈归属见[共同反馈规则](../components.md#notifications)。
