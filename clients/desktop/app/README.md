# 桌面工程

本工程维护编译、开发监听、资源准备、私有原生能力、打包及验证。使用方式见根[开发指南](../../../CONTRIBUTING.md)，各模块关系见[工程边界](../../../ARCHITECTURE.md)。

`tools/build` 接收明确的程序输入，`build:fixture` 脚本使用 [runtime 测试载体](tests/fixtures/runtime/README.md)。载体的四个 renderer/preload 入口和 utility process 用于工程验证，产品行为按[工作包](../../../refactor/implementation/work-packages.md)交付。

`native` 拥有固定 Rust 工具链下的文件同步和不覆盖移动。Node 入口 `#native` 显式接收二进制路径，加载和操作失败保留所属错误合同。`assets` 保存固定字体输入、图标源稿与许可。

`tsconfig.json` 组织七个实际环境的类型项目；常规 Node、Electron Node 模式、真实 Electron、开发工作流、制品与性能分别使用自己的测试入口。工程载体遵守真实环境的类型检查。

开发测试在隔离 workspace 中创建合成依赖，验证失败保留、候选采用、热更新、正常退出取消与清理。编译器、文件监听和进程使用真实工具，合成包和本地测试消息不承担公开产品合同。

构建与打包清单归 `tools/lib`。`out` 与 `dist` 由相应任务交接，开发会话拥有独立输出目录；`clean` 仅删除声明输出。制品检查核对同一构建的身份、字节和 fuses，当前验收范围见[状态页](../../../refactor/implementation/status.md)。
