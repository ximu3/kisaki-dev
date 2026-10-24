# Kana 公开输入与声明消费验证

检查覆盖两个入口的环境隔离、资源与操作输入、独立呈现设置、布局反馈及同步按键回调。试件只验证类型约束，没有实现或运行 Reader；公开行为由[接入合同](../../../design/projects/kana/api.md)定义。

## 声明与消费

[contracts.d.ts](contracts.d.ts) 定义一份纯值合同；[browser.d.ts](browser.d.ts) 从它直接导入实际需要的类型，补充 ByteSource、成员读取、字体、临时存储、Reader 和浏览器输入。它们是设计试件，不是从尚不存在的正式 Kana 源码生成的发行声明。正式项目仍须由同一份真实实现生成类型。

[consumer-pure.ts](consumer-pure.ts) 只从 @ximu3/kana/contracts 消费值；[consumer-browser.ts](consumer-browser.ts) 从两个公开入口使用资源、观察、导航、搜索、标记、URL 输入和关闭。[consumer-view.ts](consumer-view.ts) 通过同一个 Reader 验证稳定视图读取及两种目标的结果关联。消费文件内的函数不执行。

执行：

```powershell
python refactor/verification/evidence/kana-api/check-contracts.py
```

[check-contracts.py](check-contracts.py) 将两个声明文件及 types-only exports 装入临时 tarball，然后解包到 node_modules/.cache/kana-api 下独立的消费目录。消费方只按包名与公开子路径解析，不依赖工作区 alias，也不直接导入声明源文件。没有安装到工作区依赖或改写锁文件。

| 消费环境 | 检查条件                                                                         |
| -------- | -------------------------------------------------------------------------------- |
| 纯值     | NodeNext；lib 只有 ES2023；types 为空；无 DOM、Node 或第三方环境声明             |
| 浏览器   | Bundler；ES2023、DOM、DOM.Iterable；不安装 Node 环境声明                         |
| 共同约束 | strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess；skipLibCheck=false |

三份正向消费分别在纯值和浏览器两种环境中通过。随后移除 @ts-expect-error，确认所有无效用法确实产生诊断，避免仅靠注释声称被拒绝。共 58 项拒绝覆盖不同寻址系统混用、空页面／四边形、编码与错误原因、环境隔离、资源输入和持有、异步操作、历史与参考查看、独立呈现设置、配色分支、布局反馈及空间不足错误。最新两项分别拒绝异步按键回调和要求 KeyboardEvent 的处理器；原有检查继续通过。

结果见 [declaration-contract.json](declaration-contract.json)，包含编译器版本、检查选项、诊断数量、tarball 指纹及六份源文件指纹。源码修改后需要重跑才能继续采用该结果。

## 来源与证据限制

环境隔离依据 [TypeScript lib 配置](https://www.typescriptlang.org/tsconfig/lib.html)；包入口依据 [Node package exports](https://nodejs.org/api/packages.html#conditional-exports)。运行期资产部署另外核对了 [Vite 静态资源处理](https://vite.dev/guide/assets.html#new-url-url-import-meta-url)：动态构造资源地址不能被当作必然已经完成资产复制。

此外读取了 [WHATWG 编码名称](https://encoding.spec.whatwg.org/encodings.json)、[CSS 字体加载](https://drafts.csswg.org/css-font-loading/)和 [HTTP 范围条件](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-range)。六项来源的 URL、时间与指纹保存于 [source-contract.json](source-contract.json)；TextEncoding 的 39 个规范名称与编码表去除 replacement 后的集合一致。这只是名称核对，未运行 39 种文本解码。

本轮验证的 tarball 只有声明入口，没有运行脚本、worker、Wasm 或样式。它不能证明 Node 运行时导入、浏览器加载、字体释放、取消接续、顺序调度、位置恢复或正式包资产正确。此前部分浏览器机制和 PDF／ZIP 读取的实测仍见[阅读路线验证](../kana/reading-route.md)，已保留格式的未通过项保持原状态。

回调参数与纯值的静态约束也不能替代运行行为：observe 的初始交付、重入、回调抛错和关闭最终通知还须在实际 Reader 中验证。void 返回类型不会排除 async 函数，Reader 仍按通知合同处理，不等待调用方返回的 Promise；纯函数声明存在不代表解析器或数值校验已经运行。
