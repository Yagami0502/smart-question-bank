# MindForge - 校园智能学习题库

MindForge 面向“AI 学习与校园应用赛道”。它解决的核心问题是：学生经常收到老师发来的 Word、Excel、文本资料或题目截图，但这些资料很难直接用于复习。MindForge 可以把这些学习材料整理成可练习题库，并自动生成错题本、复习计划和学习统计。

## 赛道一定位

- **真实校园场景**：课堂资料、课后习题、考试截图、英语词汇表都可以沉淀为个人题库。
- **AI 辅助整理**：文本题目和图片题目可通过 AI 解析为结构化题目。
- **持续学习闭环**：导入题目后，系统提供智能练习、错题收集、收藏、学习计划、成就和统计报表。
- **低门槛使用**：非计算机专业学生也可以注册账号、导入资料、开始刷题。

## 核心流程

1. 创建一个题库，例如“高数期末复习”。
2. 上传老师发的 Excel、CSV、TXT、Markdown 或题目截图。
3. 使用本地解析或 AI 解析，把资料转成选择题、判断题、填空题、简答题。
4. 进入预览页确认题目、答案和解析。
5. 开始练习，系统自动记录答题结果。
6. 错题进入错题本，后续可集中强化。
7. 学习统计展示正确率、学习时长、连续学习天数和复习轨迹。

## 照片/截图如何分析

图片导入使用“多模态模型识别 + 结构化解析”流程：

1. 前端把图片读取为 Data URL。
2. 调用用户在“设置 > AI 设置”中配置的 OpenAI-compatible 接口。
3. 模型先识别图片中的题目文字，再按固定 JSON 格式输出题干、题型、选项、答案、解析、标签和难度。
4. 系统把 JSON 转换为可练习题目，并进入导入预览页。

建议使用清晰截图、正向拍摄、避免强反光和大角度倾斜。图片解析需要支持视觉输入的模型，例如 `gpt-4o-mini` 或同类多模态模型。

## 功能

- 题库管理：创建、编辑、公开/私有题库。
- 多格式导入：CSV、Excel、文本、Markdown、Word、截图/照片。
- 多智能体解题：解析、解题、审校三个 OpenAI 智能体依次交接任务，自动生成答案与详细题解。
- 协作可视化：实时显示每个智能体的执行状态、耗时、题量、模型响应 ID 与任务摘要。
- 可信导入：题目来源证据定位、分级置信度、争议题双智能体会审和低置信度人工确认门槛。
- 多题型练习：单选、多选、判断、填空、简答。
- 智能复习：基于间隔重复思想安排新题和复习题。
- 错题本与收藏：自动记录错题，支持专项练习。
- 学习计划与提醒：设置阶段目标和日常学习节奏。
- 数据统计：正确率、学习时长、连续学习、热力图、错题分析。
- 词汇学习：公共词库、个人词库、错词本、听写和发音。
- 后台管理：用户、题库、词库和系统统计管理。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS |
| 状态管理 | Zustand、Dexie |
| 图表 | Recharts |
| 后端 | Node.js、Express |
| 数据库 | MySQL 8 |
| 鉴权 | JWT、Refresh Token、bcrypt |
| 部署 | Docker Compose、Nginx |

## 本地运行

```bash
npm install
npm run dev
```

后端需要单独启动：

```bash
cd server
npm install
npm run dev
```

本地后端需要 MySQL，并配置环境变量。可以参考 `.env.example`。

## Docker 一键运行

先创建 `.env`：

```bash
copy .env.example .env
```

把 `JWT_SECRET` 和 `JWT_REFRESH_SECRET` 改成两段足够长的随机字符串，然后运行：

```bash
docker-compose up --build
```

访问：

- 前端：http://localhost
- API 健康检查：http://localhost/api/health

## Docker 热更新开发

需要边改代码边看效果时，使用开发版 Compose：

```bash
docker compose -p mindforge-dev -f docker-compose.dev.yml up --build
```

访问：

- 前端热更新：http://localhost:5200
- API：http://localhost:3002/api/health
- MySQL：localhost:3307

开发版会把当前源码挂载进容器，前端通过 Vite HMR 自动刷新，后端通过 nodemon 自动重启。

## AI 设置

出于安全原因，项目不再内置任何 API Key。使用 AI 文本解析或图片解析前，需要在应用内打开：

`设置 > AI 设置 > AI 转换`

填写：

- API 地址，例如 `https://api.openai.com`
- 模型名称，例如 `gpt-5.4-mini`（需与所用 OpenAI-compatible 服务的模型列表一致）
- API Key

生产环境推荐通过服务端 `OPENAI_API_KEY` 配置；比赛演示也兼容在设置页临时填写 Key。Key 不会提交到代码仓库。

## 参赛演示建议

推荐演示主线：

1. 注册并登录。
2. 创建“课堂截图复习”题库。
3. 上传一张题目截图，展示 AI 自动识别题目。
4. 在预览页确认题目并导入。
5. 开始练习，故意答错一题。
6. 打开错题本和学习统计，展示自动沉淀的复习闭环。

## 验证命令

```bash
npm run test
npm run build
```
