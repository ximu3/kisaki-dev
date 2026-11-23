# calibre 与 Playnite 的导入图片对照

合成 calibre 资料笔记和 Playnite 备份里，各有一张正确解析到路径、字节读全但 IDAT CRC 错误的 PNG。保留两份原件，作为区分“资源可读”与“可解码采用”的反例。

[验证脚本](verify.ts)复制 calibre `.calnotes` 的合成笔记数据库，在副本中将 calres 地址、引用表和内容摘要一起更新到新 PNG。Playnite 正例由同一合成 ZIP 的成员生成，仅替换游戏引用的 `libraryfiles\synthetic\cover.png`。两组使用相同的引用解析边界读取正负样本。脚本核对两份反例的 IDAT CRC 均不符并验证严格解码拒绝；两个正例完整解码为 2×1 RGBA，核对两个像素和 Alpha。[实际结果](results.json)

在已安装本仓库依赖的环境运行 `node refactor/verification/evidence/importer-images/verify.ts <fflate ESM 文件> <合成 Playnite 读器路径>`。Playnite 读器按[原生试件步骤](../playnite-importer/live-backup.md)准备。脚本从桌面包使用锁定的 Sharp，全部物料是合成数据，正例临时生成。正式资源准备、未采用项反馈和导入写入仍按[迁移验收](../../scenarios/importers.md)检查。
