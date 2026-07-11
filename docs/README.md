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

该方式通过 OpenAI Responses API 的视觉输入完成识别。

### 3. 多智能体解题与审校

所有来源最终进入同一条可观察工作流：

1. 解析智能体忠实切分题目并识别题型、选项和已有答案。
2. 解题智能体独立推导答案，补全分步骤题解和干扰项分析。
3. 审校智能体交叉检查题型、答案与推导，对确定错误进行修正并输出可信度。
4. 前端展示各阶段真实状态、耗时、题量、token 使用和任务摘要，最终结果由学生确认后写入题库。

质量控制规则：

- 每题携带来源文件、文本/表格行号或图片归一化区域及原文摘录，预览页可直接核对。
- 可信度低于 82%、题目有歧义或审校主动标记时，才启动挑战者智能体独立重算，再由裁决智能体比较两份推导。
- 裁决后仍为低置信度的题目必须由用户勾选人工确认，确认前禁止导入。
- 当前完整来源证据保留在导入会话中，本地 IndexedDB 可保留简要 `sourceFile`；MySQL 跨设备持久化完整证据需要后续增加来源证据表，当前版本不宣称已经支持。

OpenAI Key 优先从服务端 `OPENAI_API_KEY` 读取；设置页中的临时 Key 仅用于本地演示兼容。生产部署不应把 Key 保存在浏览器。

### 4. 练习与复习

- 支持单选、多选、判断、填空、简答。
- 支持智能复习、新题练习、强化训练、模拟考试。
- 支持错题本、收藏、笔记、标签和知识图谱。

### 5. 学习闭环

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
VITE_AI_MODEL=gpt-5.4-mini
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
2. 上传老师发的题目截图，展示题目与原图区域的来源证据定位。
3. AI 自动识别并生成答案与题解，现场展示五个智能体的条件协作。
4. 对一道人为模糊题展示挑战者独立重算、裁决结果与人工确认门槛。
5. 导入后开始练习，故意答错一题并展示错题本。
6. 打开统计页，展示正确率、学习时长和复习轨迹。

## 风险说明

- 图片识别效果取决于模型视觉能力和图片清晰度。
- API Key 由用户自行配置，项目不内置密钥。
- Docker 首次构建会安装依赖并编译前端，耗时取决于网络环境。
