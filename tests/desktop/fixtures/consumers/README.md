# 合成消费者

这里的源码是桌面包消费者测试拥有的合成样本，没有个人资料或外部内容。测试复制到独立临时工程，再从明确的 tarball 输入安装依赖。根 tsconfig.json 组织 Node、框架无关页面、Solid 页面与工程工具四个类型环境，测试通过 tsc -b 执行完整声明检查；工具配置归 config/typescript。

这些样本验证 W00 已交付的入口与样式，不是 W08 的官方生成模板，也不证明尚未实现的 SDK 宿主能力。

## 配置文件

| 文件                                                                           | 用途                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [tsconfig.json](tsconfig.json)                                                 | 独立消费者的类型检查入口，组织四个声明消费环境。           |
| [node/tsconfig.json](node/tsconfig.json)                                       | 以 NodeNext 解析公开包，完整检查 Node 消费代码及依赖声明。 |
| [webview/tsconfig.json](webview/tsconfig.json)                                 | 完整检查无框架浏览器消费代码及依赖声明。                   |
| [solid/tsconfig.json](solid/tsconfig.json)                                     | 完整检查 Solid JSX 消费代码及依赖声明。                    |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 独立检查消费者的 Vite 配置及其工具声明。                   |
