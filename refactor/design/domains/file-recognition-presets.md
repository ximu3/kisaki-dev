# 文件识别方案的十项预设

预设提供可载入的命名规则初值与固定样例，帮助文件名对应已有分部。规则只解释命名；实际文件准入与[阅读格式范围](../projects/kana/formats.md#format-scope)独立判断，匹配到后缀不表示内核支持该容器。

本目录由 holdings 管理，采用方式遵守[文件识别方案](file-recognition.md#recognition-presets)。每项直接提供一个完整规则初值。用户载入后在普通草稿中编辑；定义保存前不影响正式方案或目录引用。

<a id="catalog"></a>

## 目录与命名约定

| 目录 ID                           | 显示名称         | 适用媒介   | 明确采用的命名约定                                     |
| --------------------------------- | ---------------- | ---------- | ------------------------------------------------------ |
| anime-episode-number              | 正片单集号       | 动画       | 文件名主体只有一个正片编号                             |
| anime-title-episode-number        | 标题后正片集号   | 动画       | `标题 - 编号`，连字符两侧有空白，前面全部是作品标题    |
| anime-dual-main-number            | 双编号取主号     | 动画       | `01 (329)` 或 `标题 - 01 (329)`，取括号前的正片编号    |
| anime-dual-alternate-number       | 双编号取替代号   | 动画       | 同样的双编号结构，明确采用括号中的正片编号             |
| book-volume-number                | 单卷号           | 漫画、小说 | 文件名主体只有一个卷号                                 |
| book-title-volume-number          | 标题后卷号       | 漫画、小说 | `标题 - 卷号`，前面全部是作品标题                      |
| comic-work-chapter-number         | 作品话号         | 漫画       | 文件名主体只有一个作品话号                             |
| comic-title-work-chapter-number   | 标题后作品话号   | 漫画       | `标题 - 话号`，话号在全作品范围解释                    |
| comic-volume-local-chapter-number | 卷目录＋卷内话号 | 漫画       | 文件直属卷目录，文件名主体为卷内话号                   |
| comic-volume-work-chapter-number  | 卷目录＋作品话号 | 漫画       | 文件直属卷目录，文件名主体为作品话号，同时限定属于该卷 |

编号模板支持 ASCII 非负整数及一个点号后的数字文本，保留捕获原文。它们只声明单编号，不接收范围、编号清单、文字编号、发布修订或技术附注。标题模板中的作品标题只确定命名位置，不生成分部名称条件。双编号使用成对 ASCII 圆括号，不自动交换主号与替代号，也不同时关联两者。完整预设输入拒绝 CR、LF、U+2028 和 U+2029，与[扫描预设](scanner.md#presets)使用相同边界；自定义规则仍由自己的表达式决定。

卷目录模板选择“路径”作为[匹配文本](file-recognition.md#recognition-inputs)，允许卷目录前有其他目录。普通卷文件夹不需要单独登记为内容目录。文件的直接父目录须为 `02`、`Vol.02`、`Volume 02`、`第02卷` 或 `卷02` 这类结构；卷、巻、册均按所列前后位置支持。末级文件名主体只能是编号，扩展名清单仅适配已确认阅读目标的输入形式，不据此判断卷或话。没有扩展名的末级编号也可用于已确定的图片目录。

两个卷目录模板都先唯一确定真实卷，并要求话确实被该卷收录。卷内话号模板查询收录的 number_label；作品话号模板查询 ComicChapter.number_label，再核对收录。卷仅形成查找范围，不产生文件卷关联。来源卷格式 `c012 (v02)` 不属于这两个模板，不把发布来源说明变成卷收录要求。

同一卷号预设可以初始化漫画方案或小说方案，但不会生成跨媒介方案。采用时根据当前媒介确定具体方案类型；后续规则编辑仍只能使用该媒介允许的目标。

<a id="definitions"></a>

## 完整规则初值

下表使用稳定的预设目录 ID。载入时为方案内规则生成新 id，按当前界面语言填入可编辑名称，并将 rule 保存为 definition.rules 中唯一的规则初值。新方案按共同预设流程建立身份、名称与说明；已有方案载入预设时，只替换规则定义草稿，保留方案身份和基本资料。

所有编号输出明确保存 offset 为 0，包括卷范围。只有两个卷目录模板的 ignoreCase 为 true，用于其英文卷标记和扩展名；原始编号和文字不因此转小写。JSON 中的 pattern 是经过 JSON 转义的表达式正文，执行仍统一增加严格的完整字符串约束。

```json
[
  {
    "id": "anime-episode-number",
    "workTypes": ["anime"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?<number>[0-9]+(?:\\.[0-9]+)?)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "episode",
            "episodeType": "regular",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "anime-title-episode-number",
    "workTypes": ["anime"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?<title>\\S[^\\r\\n\\u2028\\u2029]*?)[\\t\\p{Zs}]+-[\\t\\p{Zs}]+(?<number>[0-9]+(?:\\.[0-9]+)?)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "episode",
            "episodeType": "regular",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "anime-dual-main-number",
    "workTypes": ["anime"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?:(?<title>\\S[^\\r\\n\\u2028\\u2029]*?)[\\t\\p{Zs}]+-[\\t\\p{Zs}]+)?(?<main>[0-9]+(?:\\.[0-9]+)?)[\\t\\p{Zs}]*\\((?<alternate>[0-9]+(?:\\.[0-9]+)?)\\)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "episode",
            "episodeType": "regular",
            "number": {
              "kind": "single",
              "value": "$<main>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "anime-dual-alternate-number",
    "workTypes": ["anime"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?:(?<title>\\S[^\\r\\n\\u2028\\u2029]*?)[\\t\\p{Zs}]+-[\\t\\p{Zs}]+)?(?<main>[0-9]+(?:\\.[0-9]+)?)[\\t\\p{Zs}]*\\((?<alternate>[0-9]+(?:\\.[0-9]+)?)\\)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "episode",
            "episodeType": "regular",
            "number": {
              "kind": "single",
              "value": "$<alternate>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "book-volume-number",
    "workTypes": ["comic", "novel"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?<number>[0-9]+(?:\\.[0-9]+)?)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "volume",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "book-title-volume-number",
    "workTypes": ["comic", "novel"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?<title>\\S[^\\r\\n\\u2028\\u2029]*?)[\\t\\p{Zs}]+-[\\t\\p{Zs}]+(?<number>[0-9]+(?:\\.[0-9]+)?)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "volume",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "comic-work-chapter-number",
    "workTypes": ["comic"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?<number>[0-9]+(?:\\.[0-9]+)?)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "chapter",
            "numberBasis": "work",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "comic-title-work-chapter-number",
    "workTypes": ["comic"],
    "rule": {
      "enabled": true,
      "input": "baseName",
      "pattern": "^(?<title>\\S[^\\r\\n\\u2028\\u2029]*?)[\\t\\p{Zs}]+-[\\t\\p{Zs}]+(?<number>[0-9]+(?:\\.[0-9]+)?)$",
      "ignoreCase": false,
      "output": {
        "targets": [
          {
            "kind": "chapter",
            "numberBasis": "work",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            }
          }
        ]
      }
    }
  },
  {
    "id": "comic-volume-local-chapter-number",
    "workTypes": ["comic"],
    "rule": {
      "enabled": true,
      "input": "path",
      "pattern": "^(?:[^/\\r\\n\\u2028\\u2029]+/)*(?=(?:[0-9]+(?:\\.[0-9]+)?|Vol(?:ume)?\\.?[\\t\\p{Zs}]*[0-9]+(?:\\.[0-9]+)?|第[0-9]+(?:\\.[0-9]+)?[卷巻册]|[卷巻册][0-9]+(?:\\.[0-9]+)?)/)(?:Vol(?:ume)?\\.?[\\t\\p{Zs}]*|第|[卷巻册])?(?<volume>[0-9]+(?:\\.[0-9]+)?)[卷巻册]?/(?<number>[0-9]+(?:\\.[0-9]+)?)(?:\\.(?:zip|cbz|rar|cbr|pdf|epub|mobi|azw3?|fb2|txt))?$",
      "ignoreCase": true,
      "output": {
        "targets": [
          {
            "kind": "chapter",
            "numberBasis": "volume",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            },
            "volume": {
              "number": {
                "value": "$<volume>",
                "offset": 0
              }
            }
          }
        ]
      }
    }
  },
  {
    "id": "comic-volume-work-chapter-number",
    "workTypes": ["comic"],
    "rule": {
      "enabled": true,
      "input": "path",
      "pattern": "^(?:[^/\\r\\n\\u2028\\u2029]+/)*(?=(?:[0-9]+(?:\\.[0-9]+)?|Vol(?:ume)?\\.?[\\t\\p{Zs}]*[0-9]+(?:\\.[0-9]+)?|第[0-9]+(?:\\.[0-9]+)?[卷巻册]|[卷巻册][0-9]+(?:\\.[0-9]+)?)/)(?:Vol(?:ume)?\\.?[\\t\\p{Zs}]*|第|[卷巻册])?(?<volume>[0-9]+(?:\\.[0-9]+)?)[卷巻册]?/(?<number>[0-9]+(?:\\.[0-9]+)?)(?:\\.(?:zip|cbz|rar|cbr|pdf|epub|mobi|azw3?|fb2|txt))?$",
      "ignoreCase": true,
      "output": {
        "targets": [
          {
            "kind": "chapter",
            "numberBasis": "work",
            "number": {
              "kind": "single",
              "value": "$<number>",
              "offset": 0
            },
            "volume": {
              "number": {
                "value": "$<volume>",
                "offset": 0
              }
            }
          }
        ]
      }
    }
  }
]
```

<a id="examples"></a>

## 固定样例与失败边界

下表输入是按规则 input 准备后的文字。baseName 的示例已去掉文件扩展名；两个路径模板保留文件扩展名。反例只表示该预设未命中，是否能由后续规则或内置识别解释，继续遵守[统一识别流程](file-recognition.md#recognition-context)。

| 预设             | 正例输入                           | 实际目标条件                          | 不匹配的输入                           |
| ---------------- | ---------------------------------- | ------------------------------------- | -------------------------------------- |
| 正片单集号       | `03`、`13.10`                      | regular Episode，编号分别为 03、13.10 | `03v2`、`01-03`、`SP03`                |
| 标题后正片集号   | `86 - 03`                          | regular Episode，编号 03，无名称条件  | `86 03`、`86 - 03 [1080p]`             |
| 双编号取主号     | `作品 - 01 (329)`、`01(329)`       | regular Episode，编号 01              | `01`、`01 (329）`                      |
| 双编号取替代号   | `作品 - 01 (329)`                  | regular Episode，编号 329             | `01 (329) [1080p]`、`01 （329）`       |
| 单卷号           | `03`                               | 当前媒介的卷，编号 03                 | `上`、`03+04`、`Vol.03`                |
| 标题后卷号       | `作品 - 03`                        | 当前媒介的卷，编号 03，无名称条件     | `作品 03`、`作品 - 03-05`              |
| 作品话号         | `013.10`                           | ComicChapter，作品话号 013.10         | `013x1`、`13-15`                       |
| 标题后作品话号   | `作品 - 13.5`                      | ComicChapter，作品话号 13.5           | `作品 - c013`、`作品 - 13+15`          |
| 卷目录＋卷内话号 | `第02卷/01.cbz`、`作品/Vol.02/01`  | 第 2 卷收录的卷内第 1 话              | `作品/01.cbz`、`第02卷/附录/01.cbz`    |
| 卷目录＋作品话号 | `作品/02/13.CBZ`、`第02卷/13.epub` | 作品第 13 话，并且已被第 2 卷收录     | `第02卷/Ch.13.cbz`、`第02卷/13-15.cbz` |

样例先匹配表达式，再核对已经存在且唯一的真实分部。卷内编号缺失、所选卷未收录该话、编号重复或类型不符时，报告对应问题并保持既定编号依据，分部仍由资料操作创建。两个作品话号模板查找完整作品范围，两个卷目录模板查找指定卷范围，界面分别呈现。

验证还须覆盖空标题、空输入、末尾换行、括号错配、零号、点号尾零、未知扩展名、输入根变化和大小写。两个双编号预设同时存在于一份方案时，实际规则顺序决定采用哪个编号；目录 ID 或预设目录顺序不在保存后的方案之外额外决定优先级。
