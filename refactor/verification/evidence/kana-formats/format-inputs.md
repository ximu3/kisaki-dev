# Kana 输入与页序验证

本页记录 URL 输入、图片页序和 XML 共用资源。

## XML 共用资源

[资源准备](../kana-xml-input/prepare.py)取得 WHATWG 标准实体目录、Unicode 编码映射及对应来源摘要，供 XML、CFI 和源映射试件共同使用。[输入记录](../kana-xml-input/source-input.json)保存目录标识、字节数与摘要。Expat 桥接源码保留在 [bridge.c](../kana-xml-input/bridge.c)，完整语法和编码接入的结果见[编码入口验证](../kana-xml-entry/entry.md)与[编码映射验证](../kana-xml-codecs/codecs.md)。

## URL：真实 HTTP、CORS 与临时存储

[browser.cjs](../kana-url-input/browser.cjs) 启动两个本机 origin，实际浏览器 Fetch 进入 [probe.mjs](../kana-url-input/probe.mjs) 的字节输入适配，使用真实浏览器 CORS。临时文件通过真实 OPFS 创建、写入、关闭和删除。19 个场景的请求头、观察和断言见 [browser-contract.json](../kana-url-input/browser-contract.json)。

范围方式要求实际 206、强 ETag、合法 Content-Range、稳定总长，以及能核对其字节坐标。后续使用 Range＋If-Match；正确的请求、范围响应和读取缓冲的独立性通过。返回 412、改变强 ETag 或最终 URL 不会采用新版本；区间错误、短响应、验证头消失、后续忽略 Range 的 200 被归为读取失败，不伪称内容一定改变。服务器错误复用强 ETag 不在客户端可证明的范围内。

CORS 测试覆盖必要头部不可见、仅部分暴露、明确可见的暴露列表与通配符，以及 credentials 为 include 的规则。Content-Encoding 读为 null 不足以证明不存在编码；范围输入在编码信息可验证时采用。这也说明某些合法服务器会被保守地放入快照路径，是为保证文件字节坐标付出的取舍。

服务器忽略 Range 时采用同一 200 响应流；弱 ETag 的部分响应被丢弃，随后的完整 GET 特意返回不同字节，证明没有将旧前缀拼入快照。gzip 场景的 HTTP Content-Length 为 24，Fetch 交付 128 字节；适配按后者计算实际大小与预算。当前 Chromium 对违背其 identity 请求的范围压缩响应，在 Response 交付前报网络解码失败；试件因此在打开阶段尝试一次普通 GET，未按错误消息文本分类。输入发布后不做此转换。

打开 signal 在交付之后触发不会关闭 source；单次范围读取取消后 source 可继续使用；dispose 使尚未结束的读取完成收尾。取消快照发生于实际写入之后。整个运行创建 8 个临时文件并删除 8 个，最终存活为零；服务端观测到 3 次未完成响应被取消。超出解码字节预算时没有发布部分输入。

这些结果没有覆盖所有暂存失败注入、权限／认证部署、缓存代理、网络浏览器组合、大文件吞吐或正式包里的资源调度。规范依据为 [HTTP 条件与范围请求](https://www.rfc-editor.org/rfc/rfc9110.html)及 [Fetch 的响应过滤和 CORS 规则](https://fetch.spec.whatwg.org/)。

## 图片页序：固定数据与全序

[source-input.json](../kana-image-order/source-input.json) 固定 Unicode 18.0.0 的 [UnicodeData](https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt) 与已有 CaseFolding 数据。比较器按路径段组织自然比较：默认完整大小写折叠、Nd 整数、同值数字的宽度及原名补序；不使用 Intl、系统语言或浮点数值转换，不修改成员名。

[cases.mjs](../kana-image-order/cases.mjs) 覆盖 12 组手写预期：普通页码、大小写、前导零、分层目录、全角与阿拉伯数字、超安全整数、组合形式、完整折叠展开、补充平面字符、数字与非数字的比较，以及标点。数字统一参与比较键，避免把非 ASCII 数字的原始码点与数值比较混用后形成循环。

[node-contract.json](../kana-image-order/node-contract.json) 记录 102 个不同路径的 5151 对检查：所有排序后的前后项严格一致、反向比较相反且没有两个不同路径并列；64 次固定种子打乱后顺序相同，并对固定数据中的 770 个十进制数字核对数值次序。它只验证比较机制，没有新执行真实 ZIP 提取、图片识别、页面解码或损坏页处理。

## 复现

复用原有已固定的 Expat／Emscripten、FB2 预期、Unicode CaseFolding 与 Electron 缓存后，从仓库根目录运行：

```powershell
python -B refactor/verification/evidence/kana-xml-input/prepare.py
python -B refactor/verification/evidence/kana-url-input/run.py
python -B refactor/verification/evidence/kana-image-order/prepare.py
node refactor/verification/evidence/kana-image-order/run-node.mjs
```

网络来源、构建输入和执行脚本分别保留摘要。WHATWG 活规范与数据重新下载时须核对保存的来源摘要，不能假设日后的同一 URL 永远返回所记录的字节。运行结果按实际输入与环境解释，完整格式交付见 W12。
