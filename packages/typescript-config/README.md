# TypeScript 配置

私有工程包，通过 `@kisaki3/typescript-config/base.json`、`node.json`、`browser.json` 与 `solid.json` 提供共同严格性和环境选项。消费者声明 workspace devDependency，并由自己的 tsconfig 选择源码范围、项目引用和必要的环境差异。

TypeScript 直接读取 JSON，无需构建。纯代码默认没有 Node、DOM 或测试 globals。共同基线保留 strict 并启用 skipLibCheck；公共声明消费者与自有声明拥有层显式关闭跳过，分工见[类型检查规则](../../refactor/design/engineering/workspace.md#declaration-checks)。该包不发布，也不进入产品运行依赖或仓库外作者模板。
