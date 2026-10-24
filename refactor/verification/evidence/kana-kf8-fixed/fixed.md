# 固定 KF8 二进制、页面重建与缩放定位

2026-10-20。本轮验证 [MOBI／KF8 的既有路线](../../../design/projects/kana/formats.md#mobi)：先取得原始记录和 skeleton 文档，再解释固定页面、资源与源地址。正式 Reader、公共类型、manifest 和锁文件均未改动。

## 输入与独立性

使用固定提交的 [behringer24/mobi 写入器](https://github.com/behringer24/mobi/tree/7a6319c07ad8f3ae828a533b6bfcea367e49a0cf)生成五份实际 AZW3 二进制。写入器代码未修改，MIT 许可；它仅用于制作试件，不成为 Kana 的生产依赖。[fixture.go](fixture.go) 提供自有三页内容、确定日期与 ID、480×640 固有视口、CSS 和自行生成的 240×320 图片。

读取使用已核对的 Foliate 底层代码及原始分支试件适配，固定来源、许可和改动见 [mobi-adapter-input.json](../kana-formats/mobi-adapter-input.json)。本轮调用记录、解压和索引能力，没有运行 Foliate 的显示转换或默认分支选择。

| 二进制试件                  | 目的                                 |
| --------------------------- | ------------------------------------ |
| fixed-plain.azw3            | 未压缩固定 KF8                       |
| fixed-palmdoc.azw3          | 相同内容的 PalmDOC 压缩              |
| fixed-rtl.azw3              | 相同内容与从右向左的页面方向         |
| fixed-missing-viewport.azw3 | 声明固定版式，但没有有效的原始分辨率 |
| fixed-zero-viewport.azw3    | 原始分辨率含零宽度                   |

日期、工具链、Go 模块与校验、所有写入器输入、生成器和二进制输出见 [source-input.json](source-input.json)。构建缓存位于忽略目录，未安装全局依赖或修改系统配置。

图文固定版式的固有分辨率要求可对照 Amazon 的[漫画与图片放大格式指南](https://kdp.amazon.com/en_US/help/topic/G9GSTY4LTRT39D4Z)。这里用它核对固定版式和正整数视口的来源；没有把 Kindle Panel View、文字弹窗或发行要求直接当成 Kana 的新增功能。

## 原始内容结果

五个文件均读出三个 skeleton 文档、三个去尾解压后的文字记录、两个 FDST 流和同一图片资源。文字记录按实际长度拼接，再按 skeleton／fragment 记录重建；页面源地址仍是 `documentIndex + byteOffset + 可选 textOffset`。

五份解压流、三个重建文档、CSS 及图片的对应校验全部相同。压缩方式和 RTL 元数据没有倒转文档索引或改变地址。三种有效版本得到 480×640 固有页面；两种视口异常以 invalidDocument 结束，未猜测为重排内容。另有八个视口值检查，包括正整数的前导零、零值、负数、小数和尾随字符。

第一页含跨记录的源注释以及 CJK、非 BMP、组合字符和字符引用；第二页只有图片和写入器排版空白；末页有内部 `kindle:pos` 链接。检查正文和图片源地址、链接的 fragment 到 documentIndex 映射，并改变解析分块恢复源端点。五份文件共通过 330 次文字端点重开；纯图片页没有被标为具有非空白正文，图片仍有独立的源元素地址。

这些结果来自独立写入器提供的已知内容及不同压缩文件交叉核对，没有再次执行另一套原始解码器。详细事实和源校验见 [node-contract.json](node-contract.json)。

## 浏览器页面与源对应

固定页面按已解释的源树直接建立 DOM，保留元素、Text 与源字节的绑定；只有显示资源引用转为试件的有限 HTTP 地址。三个有效文件分别以 1 和 7 个 UTF-16 单元拆分显示文字，再以 0.5 和 1.25 的比例缩放 iframe。

Chromium 149.0.7827.55、Firefox 153.0、Windows Playwright WebKit 26.5 每个引擎均通过：

- 18 次页面构建，36 个缩放状态，固有内容尺寸保持 480×640。
- 198 个原生 Range 原文核对和 792 次显示文字端点恢复。
- 24 次图片源地址与几何恢复；图片自身像素为 240×320，作者声明的页面内尺寸和位置保持不变，缩放后的点经逆变换仍命中原图片。

每次结束移除 iframe，最终关闭全部专用浏览器与 loopback 服务。请求被限制在明确的试件路由，没有外部请求。结果见 [browser-contract.json](browser-contract.json)。

## HTML 根的实际差异

同一页面另做两种构建方式的对照。直接替换 iframe 的整个 HTML 根时，Chromium 与 Firefox 得到 480×640；本次 Windows Playwright WebKit 26.5 的根与 body 几何为 0×0，虽然计算样式、图片和样式表已就绪，且已等待一帧。

保留 iframe 已初始化的 HTML 根，复制源根属性、按源树建立子节点并绑定来源后，三个引擎的全部上述检查通过。HTML 展示接入据此使用这条已验证的建立方式；源根身份不依赖替换浏览器的根对象。完整对照和精确版本见 [root-replacement-observation.json](root-replacement-observation.json)。这是一种具体构建方式的观测，不泛化为所有 WebKit、Safari 或 SVG 根的行为。

## 复现与限制

在仓库根目录执行，所需固定 Foliate、parse5 和浏览器输入沿用既有验证缓存：

```text
python refactor/verification/evidence/kana-kf8-fixed/prepare.py
node refactor/verification/evidence/kana-kf8-fixed/run-node.mjs
pnpm exec prettier --write refactor/verification/evidence/kana-kf8-fixed/node-contract.json
node refactor/verification/evidence/kana-cfi/run-browser.cjs
```

共享浏览器运行器还执行 [CFI 验证](../kana-cfi/cfi.md)，须先准备其 Expat 构建。上述脚本只写本目录的记录和忽略缓存。

这是自有内容通过独立写入器生成的受控二进制，尚未使用发行出版物或 Kindle 设备验证。RTL 目前核对元数据与源顺序，未核对双页编排或方向交互；当前 CSS、图片和固定页面也不代替复杂作者样式转换。

浏览器资源通过有限 HTTP 试件路由交付，本轮不重新验证或替换已确认的 Service Worker 后端。没有执行完整 Reader、固定 KF8 全部方言、大书按需索引、真实字体和复制交互。
