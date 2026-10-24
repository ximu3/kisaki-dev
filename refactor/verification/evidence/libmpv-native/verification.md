# libmpv Windows x64 C API 探针

本次实际加载 libmpv DLL，验证属性格式与 Stream CB 的原生行为。它是隔离的 C API 可行性检查，不是 libmpv-node 实现、JavaScript 提供器桥接或图形验证。

## 输入与运行边界

[prepare.py](prepare.py)使用 [mpv 安装页](https://mpv.io/installation/)列出的 shinchiro Windows 构建来源，固定到 20261018 的通用 x86_64 开发包。下载前选定 GitHub 资产公布的 SHA-256，校验后解压到工作区已忽略的 node_modules/.cache/libmpv-design；没有安装系统组件、修改 PATH 或项目依赖。

[binary-input.json](binary-input.json)记录归档、DLL 摘要和实际来源。运行版本是 mpv v0.41.0-1205-g01e2533f3，Client API 2.6，来源提交为 01e2533f3143b8940857ca419b0b367f583e05ca；当前主机为 Windows 10 build 19045 x64。这不是选定的发行依赖，也不是固定 v0.41.0／Client API 2.5 的构建，不能据此确认 Windows 2004 下限或其他目标。

[probe.py](probe.py)通过 ctypes 调用真实 C API，在有 20 秒总期限的自有子进程中执行。核心禁用配置与脚本的自动加载，音频和视频输出均设为 null；样本是程序生成的内存 WAV，没有读取用户媒体、显示窗口或播放声音。C 线程回调使用 Python 函数，没有运行 Node-API 或拟议的公开 JavaScript 接口。

```sh
python refactor/verification/evidence/libmpv-native/prepare.py
python refactor/verification/evidence/libmpv-native/probe.py
python refactor/verification/evidence/libmpv-native/compare-sources.py
```

## 实际结果

结果见 [native-contract.json](native-contract.json)：

| 检查             | 实际结果                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------- |
| 属性格式         | FLAG、STRING、OSD_STRING、INT64、DOUBLE、NODE 按实际格式返回；读取 NONE 返回 PROPERTY_FORMAT |
| 整数精度         | 9007199254740993 经 INT64 节点写入和读取，精确值保留                                         |
| 无值观察         | 收到一次初始及一次后续提示；格式 NONE，没有数据指针                                          |
| 带值观察         | INT64 与 STRING 通知携带对应值；OSD_STRING 登记返回 PROPERTY_FORMAT                          |
| 协议寿命         | 弱客户端登记后销毁该客户端，核心仍可通过该协议打开内存 WAV                                   |
| 重复登记         | 同名协议返回原生 INVALID_PARAMETER                                                           |
| 读取取消         | 阻塞在 read 时发送 stop，cancel 回调到达并解除读取，随后关闭一次                             |
| 打开中的取消     | open 在受控门闩中等待时，stop 没有提前触发流 cancel；解除门闩后完成收尾                      |
| 初始定位中的取消 | 初始 seek(0) 等待时也没有提前触发流 cancel；返回后完成收尾                                   |
| 流资源结束       | 四个场景均只调用一次原生 close 回调                                                          |

打开与初始定位场景的门闩在 200 毫秒后由自有辅助线程解除，以观察取消回调的时机；不将这段时长作为性能指标或超时默认值。

客户端模型另以两个核心实测：第一个核心创建两个弱客户端，经其中一个修改 pause 后，核心主句柄与另一个客户端都读取到同一状态，第二个核心保留自己的状态。销毁一个客户端后，其同核心的另一个客户端仍可调用；由后者发送 quit 并完成第一个核心销毁后，第二个核心仍可正常读取。这验证了按核心共享的范围，不等于验证了 Node 对象的拥有关系、跨客户端队列压力或进程隔离。

[compare-sources.py](compare-sources.py)对照固定设计提交与实际探针提交，[source-comparison.json](source-comparison.json)记录源码摘要。getproperty_fn、mpv_observe_property、mpv_stream_cb_add_ro 的函数文本与整个 stream/stream_cb.c 均相同。这支持当前接口判断，但周边代码、依赖与构建仍然不同，不能把相同函数文本当作整个固定版本已执行。

## 尚未证明

本次只证明上述 C 调用在这一 Windows x64 构建和主机上的结果。未验证 Node Promise／线程安全回调、异步提供器资源交接、完整属性目录、原生图形、硬件解码、HDR、其他架构或其他操作系统。对应标记保持 false，固定版本、正式制品与六目标验收仍须分别完成。

后续[Node 桥接原型](../libmpv-node-bridge/verification.md)复用相同 DLL，单独记录真实 addon 与异步提供器的运行证据；不改写本组 C API 探针的历史标记。
