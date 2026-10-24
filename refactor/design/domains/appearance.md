# 主题、字体与外观呈现

appearance 负责主题目录、用户主题、扩展主题登记、全应用预览和当前有效外观。fonts 独立管理用户字体库，preferences 保存选用的主题、明暗策略与界面缩放。主题定义、资源读取和文档中的字体加载分别管理自己的生命周期。

<a id="ownership"></a>

## 模块职责与资源使用

主进程中的 features/appearance、features/fonts 和 preferences 保持独立。主题能力位于 appearance.themes，不另设顶层 themes 模块。原生主题编辑器提供完整创作能力，不依赖专用官方扩展。fonts 复用 attachments 存储字节。主题和字体库各有自己的管理界面，资源选择器可以直接打开这些界面；管理操作与偏好草稿仍按[偏好编辑规则](preferences.md#editor)独立保存。

@kisaki3/appearance 提供纯视觉词表、值规则和 CSS。desktop-contracts/appearance 定义桌面主题、字体选择及外观交付，desktop-contracts/fonts 定义 FontRef 和字体读取合同。SDK 使用相同的本体定义。

内置主题、用户主题和扩展主题共用目录与呈现方式，但生命周期不同。内置主题由应用维护，用户主题可以原生编辑和删除，扩展主题由所属实例登记，其他消费者只读。同一身份的主题更新会作用于选用者；Clone 则创建独立的用户主题。资源不可用时保留选择，并按实际影响范围回退，不复制一份扩展定义作为长期镜像。

主题只定义 token 的视觉属性，不控制组件结构、内容、菜单、操作顺序或布局，也不注入任意 CSS。ui 模块协调页面、菜单、真实视图身份及跨进程打开和关闭，windows 实现原生窗口，renderer 负责路由、组件、草稿和 Toast，具体分工见[界面入口](../ui/navigation.md)。扩展适配层负责登记，并在实例结束时释放；原生能力仍由各本体模块拥有，原生页面无需改为 Webview。

<a id="tokens"></a>

## 基础 token 与派生样式

AppearanceTokens 使用固定、扁平的 CSS 属性键，共 45 项：39 项视觉值、2 个字体栈和 4 项文字基准。每个主题分别保存完整的亮色与暗色值。下面的节选只用于说明数据形状：

```json
{
  "--background": "oklch(0.17 0.015 258)",
  "--foreground": "oklch(0.9 0.012 256)",
  "--primary": "oklch(0.64 0.17 256)",
  "--accent": "oklch(0.85 0.06 252 / 0.16)",
  "--ring": "oklch(0.64 0.17 256)",
  "--radius": "6px"
}
```

完整 token 目录如下：

| 用途           | 基础 token                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基底与表面     | --background、--foreground、--surface、--surface-foreground、--popover、--popover-foreground、--dialog、--dialog-foreground                                     |
| 操作与交互     | --primary、--primary-foreground、--secondary、--secondary-foreground、--muted、--muted-foreground、--accent、--accent-foreground、--input、--input-foreground   |
| 反馈与边界     | --destructive、--destructive-foreground、--info、--info-foreground、--success、--success-foreground、--warning、--warning-foreground、--border、--ring、--chart |
| 圆角与阴影     | --radius、--shadow-raised、--shadow-overlay、--shadow-modal                                                                                                     |
| 光效与材质     | --pane-alpha、--light-1、--light-2、--light-3、--light-strength、--grain-opacity                                                                                |
| 字体与文字基准 | --font-sans、--font-mono、--text-base-size、--text-base-weight、--text-base-line-height、--text-base-letter-spacing                                             |

表中的分组用于编辑呈现，存储使用表列出的扁平 token 键。primary、accent 和 ring 分别表示主要操作、强调与焦点，各 foreground 对应自己的表面。三种阴影分别用于 raised、overlay 和 modal，光效及材质项也保留各自含义。

字体槽保存稳定选择或资源引用，在运行时转换成 CSS 字体栈。AppearanceTokens 使用固定键目录，其他 token 分别按颜色、阴影、长度、百分比和数值等文法校验，保留 OKLCH、透明度、normal 及多层阴影等合法表达。包路径与临时 URL 留在资源读取接入中。

纯视觉包拥有词表、默认视觉值和 CSS 对应关系，桌面合同在此基础上组合字体选择。默认主题、编辑器、本体页面和 Webview 使用同一套词表，不为扩展另设缩减版本。背景能力只包括配色，不提供用户背景图片或 motion 配置，程序光效和固定纹理也不会扩大这一范围。

Tailwind 的 `--color-*`、radius-sm/md/lg/xl、字号阶梯和组件尺寸由共同样式派生。`--tw-*` 和 `--vis-*` 不持久保存，每个源值只提供一个编辑入口。局部封面光色只存在于页面运行状态。默认主题的色轴和亮度安排不强制约束其他主题。焦点统一使用 ring，radius 为 0 时，所有派生值仍必须合法。

公共 appearance 的普通 CSS 与可选 Tailwind 映射遵守[视觉包交付](../engineering/workspace.md#visual-packages)，本体各文档使用[各自的样式入口](../engineering/layout.md#renderer-styles)。UI 与应用通过同一组正式变量取得当前外观，映射、组件样式和窗口基础样式不各自保存主题副本。

<a id="theme"></a>

## 完整主题与稳定引用

主题和外观偏好定义如下：

```ts
type ColorScheme = 'light' | 'dark'

interface AppearancePreferences {
  mode: 'system' | ColorScheme
  interfaceScale: number
  theme: ThemeRef
}

interface Theme {
  ref: ThemeRef
  name: LocalizedText
  light: AppearanceTokens
  dark: AppearanceTokens
}
```

主题引用区分三种来源：

```ts
type ThemeRef =
  | { type: 'builtin'; id: 'default' }
  | { type: 'user'; id: string }
  | { type: 'extension'; extensionId: string; id: string }
```

选择、更新和 Clone 都以包含完整 light、dark 分支的 Theme 为单位。mode 决定采用哪个分支：切换主题保留 mode，切换明暗保留主题引用。两种操作均直接采用主题定义。用户组合不同作者的亮暗分支时，需要将它们保存为自己的完整主题。

ThemeRef 保存稳定身份。用户主题 id 由本体生成；扩展登记使用扩展内部 id，宿主将其绑定到真实 extensionId。get 和 open 统一接收完整 ref。Clone 必须成功读取该 ref 指向的来源，读取失败则报告失败。

用户主题名称是普通字符串，在目录中使用 LocalizedText 的字符串分支。创建或 Clone 后普通保存不会自动选用，修改已经选中的用户主题则会正常更新正式外观。默认主题同样具备完整亮暗两套值，公共入口可以取得桌面默认，不从其他扩展或上次主题补齐空缺。新增 token 通过合同和所属数据的正常演进处理，不靠重新套用模板。

<a id="scale"></a>

## 界面缩放与采用

interfaceScale 由 AppearancePreferences 统一保存，单位为百分数，100 表示原比例。--interface-scale 只作为运行投影。最终 rem 基准等于当前 --text-base-size × interfaceScale / 100。基础字号属于主题，会影响所有 rem 尺寸；缩放属于用户共同偏好，所以切换主题不保证最终字号不变。

preferences 校验并保存缩放，appearance 结合实际明暗策略和预览状态形成有效外观，再由视图宿主交付，文档负责应用 CSS 和字体。系统不提供 appearance.setScale 等平行的持久写入入口。范围及步进见[偏好](preferences.md#fields)。

切换、创建或复制主题都不改变缩放。预览使用当前正式缩放，预览期间用户修改比例也继续采用；结束预览时，按届时最新的正式主题和比例恢复，回退时也保留比例。新窗口初始化即可获得当前有效值。应用缩放不控制操作系统显示缩放、阅读正文字号或视频画面，fonts 也不决定消费者何时采用字体。

<a id="storage"></a>

## 用户主题与字体的存储

用户资源使用以下表：

| 表               | 字段                                          |
| ---------------- | --------------------------------------------- |
| themes           | id、name、light、dark、created_at、updated_at |
| fonts            | id、name、created_at、updated_at              |
| font_attachments | font_id、attachment_id、metadata              |

themes 只保存用户主题，name 为普通字符串，light 与 dark 为完整的类型化 JSON。fonts 只保存用户字体库。主表使用稳定 id 和 UTC 毫秒时间，名称允许重复，不设置全行 revision。font_attachments 使用 (font_id, attachment_id) 联合主键，并为 attachment_id 提供反查索引。删除字体可以解除关联，附件端限制删除，字节按真实引用与占用回收。

metadata 是从不可变字体文件解析出的只读技术资料，由本体生成和校验，普通读取直接使用已保存的资料。JSON 通过 customType 处理，公共类型只包含资料值，字体文件仍由 attachments 保存。

用户主题 update 按实际修改的 name 或分支 token 检查 expected，合成完整亮暗配置后一次提交。例如：

```ts
await appearance.themes.update(themeId, {
  changes: { light: { '--primary': nextPrimary } },
  expected: { light: { '--primary': originalPrimary } }
})
```

不同 token 和不同分支可以独立比较，字体选择则以完整对象为修改单位。整体替换一个分支时，核对该分支的完整原值。接口不接收任意 JSON 路径，也不会因无关分支变化而制造冲突。创建主题仍要求提供完整的两套值。

用户资源不依赖编辑器或扩展的生命周期。停用或卸载扩展，不会删除用户主题和字体。资源管理与偏好编辑各自保存，放弃偏好草稿不会撤销已经完成的资源操作。

<a id="fonts"></a>

## 字体身份、导入与编辑

字体引用定义如下：

```ts
type FontRef = { type: 'system'; family: string } | { type: 'user'; id: string }
```

FontRef 只表示系统字体族或用户字体 id。主题另行提供默认字体和所属扩展文件选项，阅读另行提供 document 选项，不把消费者专属分支放入 FontRef。系统字体、书内字体和扩展私有字体不会自动导入用户库。fonts.list 只列用户字体，listSystem 只列系统字体，选择器分组搜索，再由用途加入默认或文档选项。字体管理界面只管理用户库。

Font 包含 id、name、files、createdAt 和 updatedAt，files 的每项为 { attachmentId, metadata }。FontFileMetadata.faces 记录文件中从零开始的 index、family、subfamily、可空的 fullName 与 postScriptName、字重和宽度的 min/default/max、normal/italic/oblique 样式，以及 { tag, min, default, max }[] 形式的可变轴。静态属性的最小、默认和最大值相同，axis tag 使用实际四字节 OpenType 标识。技术资料必须由本体解析，不能接受调用方伪造；解析失败也不能编造字体族名或能力。

字体库支持 TTF、OTF、WOFF 和 WOFF2 的静态及可变字体，可以使用[fontkit](https://github.com/foliojs/fontkit)等成熟解析器，实际文档加载仍须在各平台验证。字体集合拆分和格式转换不属于字体管理的产品能力。

import({ name, files }) 接收非空的 FileInput 或 PreparedFontFile 集合，完整创建 Font。update(id, { changes, expected? }) 只允许修改 name 和最终 files：未提供 files 时保持原值，提供时整体替换，空集合拒绝保存。保留旧文件时使用 { attachmentId }，并核对它确实属于当前编辑字体；新文件使用共同文件输入。解析、附件采用和关联维护都由本体完成，不提供持久单项增删的旁路。

添加、移除或替换文件先修改草稿，保存时一次提交。name 和 files 分别核对实际基线，prepare 可以预览新文件而不先登记 Font。保存前完成准备及校验，失败保留原文件集合。文件字节不原地改写，替换关联指向新的附件。同一字体中的完全相同文件可以去重，但名称或当前内容相同不会在全库自动合并字体身份。

字体不提供 clone 或含义相同的另存副本入口。需要独立版本时，直接导入新文件并重新选择。字体不会因无人引用自动删除，独立导入也不会因后来放弃主题或偏好编辑而撤销。改名只更新目录；修改 files 后，主题读取新资源，已经打开的阅读内容则保留此次字体到下次打开。共享 FontId 表示共同接收后续更新，具体采用时机仍由消费者决定。

<a id="clone-and-delete"></a>

## 复制主题与删除资源

Clone 读取主题完整的亮暗定义。系统字体保留族名，用户 FontRef 保留共享身份；只有扩展私有字体需要实际读取并准备为新的用户字体，再重写主题中的引用。不能根据同名或相同字节复用已有的可变 FontId。源主题更新或停用不会改变副本，但副本保留的用户字体引用仍会共享字体更新，用户可以另选资源。复制不要求先读取全部用户字体文件，也不必执行完整 ThemeRead。

来源读取和文件准备在事务外完成，新字体、附件关联及主题在同一短事务中提交。失败时不能留下缺少必要字体的主题，也不能留下只为本次复制建立的可见半成品。保留原扩展私有路径不算独立副本，读取也不能暴露扩展的任意安装或私有目录。已经独立完成的普通字体导入不随 Clone 失败回滚。

删除主题不删除它引用的字体，删除资源也不递归改写消费者。原引用继续保留并明确回退，只有用户重新选择才修改配置。界面可以提示已知使用位置，但不能要求完全观察扩展私有引用后才允许删除。删除字体记录与回收字节是不同阶段，已采用该字体的阅读过程或资源句柄可以继续持有内容到结束，不能提前删除文件。

<a id="operations-and-read"></a>

## 公开操作与读取快照

主题与字体提供以下能力：

| 能力              | 方法与结果                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appearance.themes | list 返回目录摘要；get(ref) 返回完整 Theme 或 null；create/clone 返回用户 ThemeRef；update/delete 返回 void；open(ref) 返回 ThemeRead。                              |
| fonts             | list 返回 { items,total }；get(id) 返回完整 Font 或 null；listSystem 返回去重的实际系统族名；import/update 返回完整 Font，delete 返回 void；open(id) 返回 FontRead。 |
| fonts.prepare     | 返回 PreparedFontFile 供可选保存前预览，不创建正式 Font/附件；import/update 也可直接用文件输入完整执行。                                                             |
| 目录变化          | themes/fonts 各提供 onInvalidated，读取普通定义不产生释放义务；实际 open 才占用资源。                                                                                |

需要实际占用资源时，open 返回以下读取句柄：

```ts
interface ThemeRead {
  readonly theme: Theme
  readonly fontResources: ThemeFontResources
  dispose(): Promise<void>
}

interface FontRead {
  readonly font: Font
  readonly resources: Readonly<Record<string, ReadResourceRef>>
  dispose(): Promise<void>
}
```

open 取得同一次固定的定义、技术资料和受控资源，不打开界面。ThemeRead 保留原 ref、完整亮暗 token 和字体选择，fontResources 按 light/dark 及 --font-sans/--font-mono 对应读取结果。同一字体复用此次快照，系统字体族没有文件映射，扩展文件也不生成临时 FontId。FontRead.resources 以 attachmentId 为键，技术资料已经位于 font.files，不再次复制。

读取范围内的 URL 始终指向本次内容快照。扩展 package 与 data 资源使用所属范围内的相对路径，任意本地路径和远程 CSS 在接纳时拒绝。

安装包内容保留至占用释放；可变 data 和开发目录在读取时取得稳定内容，后续访问沿用该快照。读取占用与用户字体记录分别管理，释放后按资源规则清理，不形成长期版本历史。

dispose 幂等释放本次占用。普通快照仍是可读值，但其资源访问失效，其他读取不受影响。读取失败应清理本次已取得的资源，不返回半份结果。跨进程适配负责内部身份，不序列化函数、文件句柄或流。需要自行展示资源时使用[view.resources.bind](resources.md)；普通主题跟随由宿主自动处理，作者不必手动 open、bind 和 dispose。

浏览和编辑主题只需 get，当前外观只读取当前分支。只有明确请求完整 open 才取得 ThemeRead。必要资源不可读时，整次 open 失败，不能用默认值冒充所请求主题。

<a id="registration"></a>

## 扩展主题登记与启动采用

扩展通过以下方式登记、更新和释放主题：

```ts
const registration = await context.appearance.themes.register({
  id: 'violet',
  name: 'Violet',
  light: violetLightTokens,
  dark: violetDarkTokens
})

await registration.update({
  name: 'Violet',
  light: nextLightTokens,
  dark: nextDarkTokens
})

await registration.dispose()
```

Node 侧登记扩展内部稳定且唯一的 id，宿主绑定真实拥有者。返回的句柄提供只读完整 ref、update 和 dispose。update 在校验完整 name、light 和 dark 后替换定义，失败保留原值，不改变身份和寿命。重复 register 报错，不能隐式覆盖。Webview 通过所属扩展的私有业务接口保存，不直接跨拥有者写入。新实例重新 register，无需先调用 update；旧实例释放也不能影响后来建立的登记。

登记只校验定义、token 和资源范围，不加载全部字体。成功表示定义已经发布，不代表文件可读或所有文档已经绘制。扩展更换私有字体后，即使路径没变，也必须通过 update 触发新读取。宿主不在后台监听全部扩展字体，旧读取继续保留原快照。

内置和用户主题直接由本体提供。启动时，当前选用扩展主题才优先加载它已经启用的拥有者；其他扩展按正常流程加载，已停用扩展保持停用。首屏按[共同启动预算](../architecture.md#startup-readiness)等待必要主题和字体就绪，或采用明确的回退结果。主题使用运行期登记，主题不可用时保留引用，并按 mode 回退默认。资源恢复后，appearance 沿正常的目录、选择与预览计算更新有效外观，再由各文档接入完成字体加载与实际采用。

<a id="view"></a>

## 每个文档的外观与字体加载

宿主向文档交付以下外观值：

```ts
interface ViewAppearance {
  colorScheme: ColorScheme
  interfaceScale: number
  cssVariables: Readonly<Record<keyof AppearanceTokens, string>>
  fontFaces: readonly ViewFontFace[]
}
```

ViewAppearance 交付当前文档的运行呈现值。colorScheme 已解析为实际 light 或 dark；cssVariables 将固定 token 转为 CSS，字体选择转为运行族名，interfaceScale 单独交付。ViewFontFace 为 { family, url, descriptors }，url 已绑定到目标文档，可直接使用。描述符包含合法的 weight、style 和 stretch；unicodeRange、variationSettings 和 featureSettings 按真实数据提供。FontFace 实例与释放函数由实际运行端管理，持久主题仍使用 Theme。

appearance 读取当前分支所需资源，宿主绑定目标文档并交付完整外观。接收方创建 FontFace，加载后加入自己的 document.fonts，等必要字体就绪或取得明确回退结果，再采用 CSS。每个主窗口、阅读器和 iframe 都要自己加载，不能复制字体族名后就假定另一文档的字体可用。具体机制见[CSS Font Loading](https://www.w3.org/TR/css-font-loading-3/)与[CSS Fonts](https://www.w3.org/TR/css-fonts-4/#font-face-rule)。

多个静态字重可以用多条描述共享字体族，可变字体则可以使用一条范围描述。多 face 文件必须提供可独立加载的内容，必要的技术转换资源归本次读取范围，不假定浏览器会按文件内部 index 自动选择。

运行族名区分实际内容快照，不能只依据 FontId，因此新旧字体内容可以同时存在。仅颜色或缩放改变时，不重新加载相同字体。每次完整外观只采用最新有效结果，不能混用不同请求中的颜色、字体和明暗分支。替换完成后移除不再使用的 FontFace 并释放旧绑定；文档销毁时清理自己的对象与占用，不影响其他文档。

文档初始化立即取得当前有效外观，并持续接收同步。某个字体不可用时只回退对应槽位，保留其他主题值；整个主题不可用时才回退默认。新字体准备期间继续显示旧外观，成功或明确回退后再切换。单个文档失败不能撤销全应用预览或改写正式选择，也不应让每个窗口重复发出同一通知。阅读外壳跟随应用外观，正文按自身偏好的采用时机处理。

<a id="preview"></a>

## 绑定真实视图的全应用预览

扩展 Webview 通过 context.appearance.preview(input) 取得 AppearancePreview。原生编辑器直接使用相同本体能力，不模拟扩展上下文。

编辑器仅提供全应用预览，预览开关默认关闭。亮暗切换只决定当前编辑分支，不修改正式 mode。开启预览后，全应用临时采用该分支草稿；修改内容或切换编辑分支都会更新预览。关闭预览时，编辑不影响实际外观，控件本身仍正常显示色值。

预览经过正式的解析、资源读取和呈现流程，不写入偏好、不更新主题目录，也不创建草稿主题项。它覆盖四类原生窗口及宿主 Webview，新开窗口同样获得当前预览值。阅读正文、视频和外部游戏不属于应用主题。编辑器不逐窗注入 CSS，也不通过先写正式设置、结束后再回滚来实现预览。

预览合同如下：

```ts
interface AppearancePreviewInput {
  colorScheme: ColorScheme
  tokens: AppearanceTokens
}

interface AppearancePreview {
  update(input: AppearancePreviewInput): Promise<void>
  dispose(): Promise<void>
  onDispose(listener: () => void): Disposable
}
```

入口从调用环境绑定真实拥有者，原生调用无需伪造扩展 context。SDK Node 侧负责主题登记和资源持久操作，Webview 侧负责真实视图的外观与预览，业务保存经私有 IPC 完成。预览只需要当前分支的完整 tokens 和 colorScheme，不要求主题 ref 或另一分支。

全应用同时只存在一个预览。后一次明确开启会接管预览，原编辑器同步停止；接管后原预览结束。关闭开关、实际关闭编辑器或拥有者失效时 dispose，取消关闭则继续预览。结束通知只发生一次，结束后订阅也能得知已结束。已结束句柄拒绝 update，重复 dispose 没有副作用；旧句柄的迟到操作只作用于其已结束状态。

新值校验失败时保留原有效预览。再次开启会取得新句柄，并沿用仍在内存中的草稿。创建或更新预览成功，表示校验、必要资源准备和发布完成，不代表所有文档已绘制；各文档仍按完整快照协调应用。停止后解析届时最新的正式选择、明暗和缩放，不恢复编辑开始前的旧快照。关闭预览不会丢弃编辑草稿。

<a id="save"></a>

## 保存与保存并选用

保存只更新用户主题及目录。“保存并选用”先保存主题，再通过 preferences.update 修改 appearance.theme，保留 mode 与 interfaceScale，不提供另一处“当前主题”写入入口。新主题使用真实保存后的身份，未保存草稿或资源不能被选用。即使预览开关关闭，用户仍可以执行这项操作。

内容保存使用编辑期间相关字段的基线。发起“保存并选用”时，同时固定本次主题内容和当时的正式主题选择；内容保存完成后，使用这份选择作为 preferences.update 的 expected，不在选用前刷新基线。准备或保存期间，其他入口改变了正式选择时，主题仍保持已保存，选用报告 Conflict，界面显示“已保存但未选用”。保存成功后才继续选用，运行采用失败按实际阶段反馈；普通即时选用遵守直接设置语义。这是值比较，不追踪选择曾经改变后又回到原值的中间过程。

正式选用成功后，只结束本编辑器仍然拥有的预览，不能清除已被其他编辑器接管的预览。如果预览的是暗色，而正式 system 当前解析为亮色，结束后显示新主题的亮色分支；编辑目标不改变正式模式。用户后来放弃偏好界面的草稿，也不会撤销已经完成的选用。

<a id="localization"></a>

## 目录文案与用户名称

主题和模板目录使用现有 i18n 与 LocalizedText。扩展可以提供普通字符串或多语值，品牌名称可以不翻译；显示按有效 UI 语言和扩展 defaultLocale 回退。身份、token 与字段键、枚举、正则、筛选值和资源都不翻译。翻译预设说明也不能改变资料语言或来源规则。

模板中用于初始化用户名称、区块标题等明确显示文本的值，在载入草稿时按当前语言解析为普通文字。保存后，它们就是用户内容。切换语言只更新目录，不改正在编辑的草稿或已有名称。各模板明确声明哪些初值可本地化，不按任意 JSON 路径翻译全部字符串。原生用户主题和 Clone 主题使用普通字符串命名，不要求用户维护译本目录。
