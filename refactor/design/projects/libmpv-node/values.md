# libmpv-node 的值与转换

本页定义输入、原生结果、公开值表示与转换失败。

<a id="values"></a>

## 按原生类型转换值

默认 JavaScript 输出按实际原生格式确定表示，不根据数值大小改变返回类型：

| 原生值            | JavaScript 表示 | 边界                                                       |
| ----------------- | --------------- | ---------------------------------------------------------- |
| FLAG              | boolean         | 保留布尔含义                                               |
| INT64             | bigint          | 覆盖完整有符号 64 位范围，输入越界时拒绝                   |
| DOUBLE            | number          | 播放秒数等浮点值维持 number，不按是否恰好为整数改成 bigint |
| 合法 UTF-8 STRING | string          | 不自行做 Unicode 归一化或文件路径改写                      |
| BYTE_ARRAY        | Uint8Array      | 数据独立持有，不借用 libmpv 临时内存                       |
| NODE_ARRAY        | 值数组          | 递归采用相同的转换规则                                     |
| 值中的 NONE       | null            | 与属性通知中的不可用状态分开                               |

这意味着 playlist 的原生整数 ID 使用 bigint；screenshot-raw 返回的 w、h、stride 也不因为通常很小就另用 number。图像消费方在确有范围保证的接入处转换尺寸。保留这条统一规则的代价是调用者有时需要显式转换，收益是整数精度与返回类型不会随内容变化。

输入同样按类型转换：bigint 对应 INT64，number 对应 DOUBLE。绑定不把一个已经失去精度的 number 自动修复成整数，也不替调用方猜测其意图。原生属性或命令自身允许的类型转换仍由 mpv 执行。已知调用的类型提示说明应传的值。

结果交付后不再由库修改。普通数组及结构在声明中只读，字节由接收方持有和修改，不提供借用缓冲或另外的 release 方法。输入值在提交原生工作前形成自己的有效数据，不在异步执行时重新读取调用方可变对象。

libmpv 允许非 UTF-8 字符串，NODE_MAP 也不保证键唯一。公开接口提供默认 JavaScript 值与显式原生表示，定义见[两种公开值](#values-values)；转换不静默替换非法编码、合并同名键或截断 C 字符串。选择依据见[方案比较](../../../verification/evidence/libmpv-values/alternatives.md)。

<a id="调用选项按输入与输出分别表达"></a>

## 输入与输出选项

采用 input 和 output，值为 javascript 或 native，缺省均为 javascript：

| 操作                                | 有效的表示选项           |
| ----------------------------------- | ------------------------ |
| command(args, options)              | input 与 output 独立选择 |
| getProperty(name, options)          | output                   |
| setProperty(name, value, options)   | input                    |
| observeProperty(name, ..., options) | output，在订阅建立时固定 |

这些选项对应可递归的 mpv 值参数和结果；名称等独立 C 字符串参数遵守其自身规则。它们不改变命令完成、取消、实例寿命或受管渲染约束。普通参数继续按已有的结构化命令形式传入，不设置改变整个 Mpv 后续调用含义的全局表示开关。

```ts
const position = await mpv.getProperty('time-pos')

const raw = await mpv.getProperty('user-data/example', {
  output: 'native'
})

await mpv.setProperty('user-data/copy', raw, {
  input: 'native'
})
```

command 选择原生输入时，整个参数表示为原生 array 或 map 节点，分别对应上游的位置参数与命名参数；选择原生输出不要求同时选择原生输入。普通对象即使包含 format 和 value 字段，也不会被自动识别为原生节点；只有对应输入选项改变它的解释。

初始化选项的 input 与有限初始化日志的独立 output 见[初始化合同](lifecycle.md)。

<a id="property-formats"></a>

## 属性请求格式与值表示

getProperty 和带值的 observeProperty 使用同一 format 选项：缺省 node，也可显式选择 flag、int64 或 double。它选择由 mpv 执行的原生读取转换；output 继续选择交付到 JavaScript 的表示，两者独立。

| format     | javascript 成功值           | native 成功值 |
| ---------- | --------------------------- | ------------- |
| node，缺省 | 已知属性对应类型或 MpvValue | 实际 MpvNode  |
| flag       | boolean                     | flag 节点     |
| int64      | bigint                      | int64 节点    |
| double     | number                      | double 节点   |

显式格式决定成功结果的类型，不再按属性名坚持另一种结果类型。转换由 mpv 完成，不能用 JavaScript Number、Boolean 或截断代替；不能转换时保留实际原生失败。显式请求浮点格式也不能保证保留原始整数精度，这与缺省 INT64 始终保持 bigint 的规则分开。

文字格式通过 getPropertyText 读取，普通文字观察通过 observePropertyText 接收，不给 getProperty 增加重复的 string／OSD 入口。它们采用同一 output 规则，分别交付字符串或独立字节；文字转换失败保留同一次 string 节点。OSD 文字可以读取，固定上游明确不允许以 OSD_STRING 观察，绑定不以轮询或格式化补造这项能力。

无值变化提示使用 observeProperty 的显式 format: none，见[观察模式](notifications.md#property-modes)。getProperty 不接受 none；array、map 与 byteArray 是节点中的存储格式，需要通过 node 读取，不是额外的属性请求格式。具体类型检查及 C API 证据见[属性访问检查](../../../verification/evidence/libmpv-properties/verification.md)。

<a id="values-values"></a>

## 两种公开值

MpvValue 专指普通 JavaScript 值：null、boolean、bigint、number、string、独立 Uint8Array、递归数组及字符串键对象。延续[类型映射](#values)，原生 INT64 始终对应 bigint，DOUBLE 始终对应 number；不根据当前大小或是否恰好为整数改变类型。

普通输出中的 map 使用无原型对象，保留全部自有字段，包括 `__proto__`。只有键均可严格解码为 UTF-8 且不重复时才转换成功；不能返回部分对象，也不替换文本或覆盖键。文本保留 BOM 与 Unicode 组合形式。字节数组允许接收方修改，库不再修改已交付的结果。

完整原生表示命名为 MpvNode，使用普通判别联合。format 确定 value 的含义；none 没有 value：

| format    | value                            | 对应上游格式          |
| --------- | -------------------------------- | --------------------- |
| none      | 不存在                           | MPV_FORMAT_NONE       |
| flag      | boolean                          | MPV_FORMAT_FLAG       |
| int64     | bigint                           | MPV_FORMAT_INT64      |
| double    | number                           | MPV_FORMAT_DOUBLE     |
| string    | Uint8Array，保存字符串字节       | MPV_FORMAT_STRING     |
| byteArray | Uint8Array，保存二进制字节       | MPV_FORMAT_BYTE_ARRAY |
| array     | readonly MpvNode[]               | MPV_FORMAT_NODE_ARRAY |
| map       | readonly [Uint8Array, MpvNode][] | MPV_FORMAT_NODE_MAP   |

map 中的每一项都是只读二元组，键保存原生字符串字节，重复项完整保留。原生输出中的 string 始终保存字节，不因其中恰好是合法 UTF-8 就改变形状。一个普通字段名 format 仍只是 map 内的一项数据，与外层节点标记分开。

```ts
const node: MpvNode = {
  format: 'map',
  value: [
    [new Uint8Array([0x61]), { format: 'int64', value: 1n }],
    [new Uint8Array([0x61]), { format: 'int64', value: 2n }]
  ]
}
```

这八类对应固定头文件允许放入 mpv_node 的实际值。MPV_FORMAT_NODE 是访问结构化值的格式，OSD_STRING 是读取显示文字的格式，两者不增加存储值分支。未知原生格式不能通过猜测 C union 内容包装成节点，应在绑定边界报告不支持的格式。

MpvNode 只含独立数据，不依赖包装类、播放器或 C 指针，不提供 dispose。它可以在 Mpv 关闭后继续持有；Node 消息传递仍遵守其克隆或转移规则，不因此获得与 NativeFrame 相同的资源身份。

<a id="inputs"></a>

## 输入校验与字节持有

两种输入都严格校验自己的合同。普通 string 拒绝孤立 UTF-16 代理项；所有映射为 C 字符串的位置，包括 map 键，都拒绝内嵌 NUL。原生 string 的字节不包含 C 终止符，byteArray 则允许零字节。int64 检查有符号 64 位范围，原生模式不会把越界值截断。

属性名称或子路径本身也是 C 字符串。getProperty、setProperty 和 observeProperty 的名称参数另接受显式 Uint8Array 字节，以便直接访问含非 UTF-8 子键的 user-data 路径。这个参数位置的含义始终是名称；选择字节名称不改变值的 input／output 表示，也不改变上游的路径分隔规则。字节名称按未知名称提供通用结果类型，普通字符串名称保留适用的已知类型提示。命令名的完整字节形式已能通过原生命令节点表达。

undefined、函数、symbol、循环数据和不属于合同的实例不能直接成为值。原生输入不跳过实例关闭检查，也不绕过受管渲染保留选项。它只使调用方能够明确使用上游的值格式，具体属性或命令是否接受该格式仍由对应合同与 mpv 错误表达。

字节输入限定为普通 ArrayBuffer 支持的 Uint8Array，包含相应 Buffer 视图；共享内存应由调用方先同步并复制成普通视图，失效或已分离的缓冲拒绝。复制只覆盖视图的 byteOffset 与 byteLength 范围，不读取底层缓冲的其他区域。输出字节的底层 ArrayBuffer 也只承载本次公开的字节，不暴露原生池或 Buffer 池中的其他内容。

提交原生操作前，绑定形成自己独立持有的有效输入，调用方随后可以继续修改原对象。字节复制、输入校验与原生释放在真实 addon 中验证，确保已提交值始终对应当次输入。

<a id="typing"></a>

## 类型提示的边界

普通输出可以继续对已知命令和属性提供具体类型，并检查实际结果是否满足承诺。未知名称返回 MpvValue，不能由调用者随意指定一个结果泛型来替代检查。

原生输出统一返回 MpvNode，消费方根据 format 收窄；不把某个属性名称永久绑定成一个原生格式。上游明确要求读取时检查实际 format，属性类型可能随版本或运行状态变化。原生输出应交付实际节点，不能为了维持普通模式的已知类型提示而拒绝另一种可合法表达的原生值。

输入／输出选项为确定字面量时，返回类型对应所选表示；输出选项本身是动态联合时，结果也保留相应联合。普通已知参数的类型错误不能落入宽泛重载而通过。完整命令目录和所有重载仍须与最终上游版本及真实导出共同核对。

表示选择必须来自实际参数，不能让调用者通过显式泛型在没有原生输出选项时取得原生结果类型。声明以运行时选项约束重载，不把可省略的格式泛型当作实际选择。

<a id="conversion"></a>

## 转换失败与原始结果

用 MpvConversionError 表达已经取得完整原生值，但无法交付所承诺的普通输出。该错误属于 binding 来源，code 为 valueConversion，reason 区分 invalidUtf8、duplicateMapKey 与 unexpectedShape。operation 标明 command、getProperty、getPropertyText、observeProperty 或 observePropertyText，不自动附带命令参数、完整路径或原始内容。[流提供器合同](streams.md#errors)定义的 openStream 同样使用该错误，保留无法转换的 URI。

这个错误只在已经保留有效原生结果时成立。对于 command，它说明已收到成功命令回复，随后发生转换失败；不说明文件加载或画面已经就绪，也不能当作命令尚未执行。原生命令失败、输入不合法、未知原生格式或无法取得有效结果的失败，不伪造这一错误及其结果快照。

提供 getNativeValue()：从错误私有持有的那次结果生成一份独立 MpvNode 副本。它不重新调用 mpv，不访问已失效的事件缓冲，也不保留整个 Mpv。重复调用会再次复制，修改返回字节不会改写内部保存的结果。

```ts
try {
  const value = await mpv.getProperty('user-data/example')
  consume(value)
} catch (error) {
  if (error instanceof MpvConversionError) {
    inspectNative(error.getNativeValue())
  } else {
    throw error
  }
}
```

原始结果不成为可枚举错误字段或 message 的组成部分，默认记录错误不会主动展开全部内容；调用方若显式提取结果，继续负责其展示、记录与传递。错误对象本身不承诺跨消息克隆后保留类型或方法，提取出的 MpvNode 则遵守普通数据规则。

该类专门表达输出转换失败，其他绑定错误见[调用合同](api.md)。附加结果以实际可取得内容为限，内存耗尽时可能无法另行生成。等待已经取消时按取消合同结束，保留结果只用于仍有效的交付。

<a id="observation"></a>

## 观察中的转换失败

输出表示在一次订阅内固定。原生输出交付可用 MpvNode 或 unavailable；普通输出交付可用 MpvValue 或 unavailable。原生值 none 可以位于 available 分支，不能与外层 unavailable 合并。

普通输出的一次待交付值转换失败，报告含有该次原生值的 MpvConversionError，并结束这一个订阅。该终止不关闭 Mpv，不中断其他订阅，也不把失败值通知成 unavailable。它只针对实际进入交付的值，仍不承诺看到已被上游或允许的合并规则省略的每个中间状态。调用方需要持续接收任意原生内容时，在建立订阅时选择 native。

单订阅终止、失败交付、初始通知与创建 Promise 的顺序、停止后的回调规则、监听器异常和事件队列中断统一遵守[订阅合同](notifications.md)。事件与日志来自不同的 C 通知结构，各自按[事件与日志合同](notifications.md)映射和转换文字，并通过真实原生运行验证。
