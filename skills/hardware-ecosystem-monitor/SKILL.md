---
name: hardware-ecosystem-monitor
description: 多硬件生态舆情监控系统，包含完整的新闻采集脚本、AI 清洗流程、前端组件、数据类型和工作流配置，可独立部署使用。
---

# 多硬件生态舆情监控 Skill（自包含完整实现）

## 适用场景

当用户需要快速搭建多硬件生态舆情监控系统时，使用本 Skill：

1. **一键部署新闻采集** - 自动从 9+ 硬件厂商抓取最新动态
2. **AI 智能清洗** - 双引擎（Gemini + 智谱）自动过滤与摘要生成
3. **前端看板展示** - React 组件展示新闻、案例、硬件兼容分析
4. **定时自动更新** - GitHub Actions 每日自动抓取并更新

## 文件结构

```
hardware-ecosystem-monitor/
├── SKILL.md
├── scripts/
│   └── fetch-news.js              # 新闻抓取与 AI 清洗脚本
├── .github/
│   └── workflows/
│       └── schedule-news-fetch.yml # GitHub Actions 定时任务
├── src/
│   ├── types/
│   │   ├── news.ts                # 新闻数据类型
│   │   └── ecoCase.ts             # 案例数据类型
│   ├── hooks/
│   │   ├── useNewsData.ts         # 新闻数据 hook
│   │   └── useCasesData.ts        # 案例数据 hook
│   └── components/
│       ├── PartnerNews.tsx        # 新闻展示组件
│       └── AllCases.tsx            # 案例管理组件（含检索、筛选、硬件兼容分析）
└── public/
    └── auto-news.json             # 抓取后的新闻数据
```

## 快速开始

### 1. 安装依赖

```bash
npm install axios rss-parser cheerio @google/genai openai dotenv
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
GEMINI_API_KEY=your_gemini_api_key
ZHIPU_API_KEY=your_zhipu_api_key
```

### 3. 运行抓取脚本

```bash
npm run fetch-news
```

### 4. 启动前端

```bash
npm run dev
```

## 核心功能

### 新闻舆情采集

| 厂商 | 数据源 | 类型 |
|------|--------|------|
| NVIDIA | RSS | 英文技术博客 |
| Hugging Face | RSS | 英文博客 |
| 华为昇腾 | HTML | 国内官网 |
| 壁仞科技 | HTML | 国内官网 |
| 昆仑芯科技 | HTML | 国内官网 |
| 寒武纪 | HTML | 国内官网 |
| 沐曦 | HTML | 国内官网 |
| 海光信息 | HTML | 国内官网 |
| 燧原科技 | HTML | 国内官网 |

### AI 清洗流程

```
原始新闻 → 关键词初筛 → 正文穿透 → Gemini 2.5 Flash → 摘要输出
                                    ↓ (失败)
                          智谱 GLM-4-Flash
                                    ↓ (失败)
                          兜底占位文本
```

### 生态案例管理

- **全文搜索** - 按案例名称/描述搜索
- **行业筛选** - 自动驾驶、金融风控、医疗影像等
- **硬件筛选** - 昇腾 910B、昆仑芯 2、海光 DCU 等
- **硬件兼容分析** - 10+ 场景智能推荐

## 数据格式

### 新闻数据

```json
{
  "id": "md5-hash",
  "vendor": "壁仞科技",
  "title": "壁仞科技完成 MiniMax M2.5 高效适配",
  "date": "2026-03-02",
  "sourceType": "HTML",
  "isManual": false,
  "summary": "壁仞科技硬核适配国产大模型，实现高效推理部署。",
  "imageUrl": "https://...",
  "link": "https://..."
}
```

### 案例数据

```typescript
{
    id: string,
    title: string,
    description: string,
    industry: string,    // 行业领域
    hardware: string,    // 适配硬件
    url: string,
    isPinned: boolean,   // 是否置顶
    createdAt: number    // 创建时间戳
}
```

## LocalStorage 存储键

| 键名 | 说明 |
|------|------|
| `manual_ecosystem_news` | 手动新增的新闻 |
| `deleted_news_ids` | 删除的自动新闻 ID |
| `edited_news_overrides` | 自动新闻的编辑覆盖 |
| `xinghe_cases_data` | 生态案例数据 |

## 定时任务配置

GitHub Actions 工作流：`.github/workflows/schedule-news-fetch.yml`

- 定时执行：每天凌晨 2:00 (UTC)
- 支持手动触发
- 输出到 `public/auto-news.json`

## 参考资料

- `references/news-types.md` - 新闻类型与来源详细说明
- `references/data-sources.md` - 数据源配置完整列表
- `references/ai-pipeline.md` - AI 清洗流程与 Prompt 详解
- `references/hardware-compat.md` - 硬件兼容矩阵说明
