# MindForge 项目说明

## 项目简介

MindForge 是一个面向校园学习场景的智能题库与复习平台。它把老师发来的 Word、Excel、文本资料和题目截图转成可练习题库，再通过错题本、学习计划和统计报表帮助学生持续复习。

项目适合参加“赛道一：AI 学习与校园应用赛道”，重点体现实用性：学生不用手工整理题目，可以把分散的学习资料沉淀为自己的复习系统。

## 主要用户

- 需要整理课堂资料、期末复习题、错题资料的学生。
- 想把题目截图、文档资料快速转成题库的学生。
- 需要查看学习进度、薄弱点和复习计划的学生。

## 关键能力

### 1. 资料导入

- CSV / Excel：适合老师发的表格题库。
- TXT / Markdown：适合复制粘贴或导出的文本题。
- 截图 / 照片：适合聊天群、课件、网页或纸质题目的图片。
- AI 粘贴解析：适合格式不规范的题目文本。

### 2. AI 图片分析

图片导入流程：

1. 浏览器读取图片文件。
2. 将图片转为 Data URL。
3. 请求用户配置的多模态模型。
4. 模型识别图片文字，并输出统一 JSON。
5. 前端转换为题库数据，进入预览确认。

该方式不绑定具体 OCR 厂商，只要模型兼容 OpenAI Chat Completions 视觉输入格式即可。

### 3. 练习与复习

- 支持单选、多选、判断、填空、简答。
- 支持智能复习、新题练习、强化训练、模拟考试。
- 支持错题本、收藏、笔记、标签和知识图谱。

### 4. 学习闭环

- 自动统计学习时长、答题数量、正确率和连续学习天数。
- 自动记录错题，支持错题专项练习。
- 学习计划、每日目标和提醒帮助保持节奏。

## 技术架构

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Tailwind CSS |
| 状态和缓存 | Zustand、Dexie |
| 数据可视化 | Recharts |
| 后端 | Node.js、Express |
| 数据库 | MySQL 8 |
| 安全 | JWT、Refresh Token、bcrypt、Helmet、Rate Limit |
| 部署 | Docker Compose、Nginx |

## 目录结构

```text
MindForge/
├── src/                  # 前端源码
│   ├── components/       # 通用组件和功能组件
│   ├── pages/            # 页面
│   ├── lib/              # API、AI、数据库适配、解析器
│   ├── stores/           # Zustand 状态
│   └── i18n/             # 国际化文案
├── server/               # Express API
│   ├── routes/           # 业务路由
│   ├── middleware/       # 鉴权、限流、校验
│   └── db/               # MySQL 连接和 schema
├── public/               # 静态资源
├── Dockerfile            # 前端构建镜像
├── docker-compose.yml    # MySQL + API + Web
└── README.md
```

## 环境变量

复制 `.env.example` 为 `.env`，至少配置：

```env
JWT_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_another_long_random_secret
CORS_ORIGINS=http://localhost
```

可选的 AI 默认项：

```env
VITE_AI_BASE_URL=https://api.openai.com
VITE_AI_MODEL=gpt-4o-mini
```

API Key 不应写入仓库。用户在应用内的“设置 > AI 设置”填写。

## 本地开发

前端：

```bash
npm install
npm run dev
```

后端：

```bash
cd server
npm install
npm run dev
```

数据库：

```bash
mysql -u root -p < server/db/schema.sql
```

## Docker 部署

```bash
copy .env.example .env
docker-compose up --build
```

访问：

- Web：http://localhost
- Health：http://localhost/api/health

## 验证

```bash
npm run test
npm run build
```

## 参赛展示脚本

1. 登录系统，创建“课堂截图复习”题库。
2. 上传老师发的题目截图。
3. AI 自动识别图片内容并生成结构化题目。
4. 导入后开始练习。
5. 故意答错一题，展示错题本。
6. 打开统计页，展示正确率、学习时长和复习轨迹。

## 风险说明

- 图片识别效果取决于模型视觉能力和图片清晰度。
- API Key 由用户自行配置，项目不内置密钥。
- Docker 首次构建会安装依赖并编译前端，耗时取决于网络环境。
