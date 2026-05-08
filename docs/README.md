# MindForge - 智能刷题系统

<p align="center">
  <img src="../public/favicon.ico" alt="MindForge Logo" width="80" height="80">
</p>

<p align="center">
  <strong>基于间隔重复算法的智能题库学习平台</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#项目结构">项目结构</a>
</p>

---

## 📖 项目简介

MindForge 是一款现代化的智能刷题系统，采用 FSRS（Free Spaced Repetition Scheduler）间隔重复算法，帮助用户高效记忆和掌握知识。系统支持多种题型、多格式导入，并提供丰富的学习工具和数据分析功能。

### 🎨 界面设计

- **液态玻璃效果** - 采用 Apple WWDC 2025 风格的毛玻璃 UI 设计
- **响应式布局** - 完美适配桌面端和移动端
- **流畅动画** - 丝滑的交互动画和过渡效果
- **可调试样式** - 内置玻璃效果调试面板，实时调整 UI 参数

---

## ✨ 功能特性

### 📚 题库管理
- **多格式导入** - 支持 Excel、CSV、JSON 格式批量导入题目
- **多种题型** - 单选题、多选题、判断题、填空题、简答题
- **公共/私有题库** - 支持创建公共题库分享或私有题库独享
- **题目搜索** - 全文搜索，快速定位题目

### 🎯 学习模式
- **智能复习** - 基于 FSRS 算法的间隔重复学习
- **强化训练** - 针对错题和薄弱知识点的强化练习
- **模拟考试** - 支持自定义题量、时间限制、难度设置
- **快速记忆** - 闪卡模式快速浏览和记忆

### 📊 数据分析
- **学习统计** - 详细的学习数据统计和可视化图表
- **学习日历** - 热力图展示学习轨迹
- **学习历史** - 时间线展示学习记录
- **知识图谱** - 可视化知识点掌握情况
- **错题分析** - 深度分析错题原因和分布

### 🛠️ 学习工具
- **番茄钟** - 内置番茄工作法计时器
- **学习计划** - 制定和跟踪学习计划
- **每日目标** - 设置每日学习目标
- **学习提醒** - 自定义学习提醒时间
- **题目笔记** - 为题目添加个人笔记
- **收藏夹** - 收藏重要题目
- **错题本** - 自动收集错题，支持专项练习

### 🏆 激励系统
- **成就徽章** - 解锁各种学习成就
- **学习连续天数** - 记录连续学习天数
- **成绩分享** - 生成学习成绩卡片分享

### ⚙️ 个性化设置
- **学习参数** - 自定义每日新题数、复习数量
- **算法调优** - 调整错题权重、衰减系数
- **AI 设置** - 配置 AI 辅助功能（单选转多选）
- **账号安全** - 密码修改、设备管理

---

## 🛠️ 技术栈

### 前端
| 技术 | 说明 |
|------|------|
| React 19 | UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Tailwind CSS | 原子化 CSS |
| Zustand | 状态管理 |
| Recharts | 数据可视化 |
| Lucide React | 图标库 |
| Dexie.js | IndexedDB 封装（离线缓存） |

### 后端
| 技术 | 说明 |
|------|------|
| Node.js | 运行时 |
| Express | Web 框架 |
| MySQL | 数据库 |
| JWT | 身份认证 |
| bcryptjs | 密码加密 |

### 部署
| 技术 | 说明 |
|------|------|
| Docker | 容器化 |
| Docker Compose | 多容器编排 |

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- MySQL >= 8.0
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd mindforge
```

2. **安装前端依赖**
```bash
npm install
```

3. **安装后端依赖**
```bash
cd server
npm install
```

4. **配置数据库**

创建 `server/.env` 文件：
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_question_bank
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

5. **初始化数据库**
```bash
mysql -u root -p < server/db/schema.sql
```

6. **启动服务**

启动后端：
```bash
cd server
npm run dev
```

启动前端：
```bash
npm run dev
```

### Docker 部署

```bash
docker-compose up -d
```

---

## 📁 项目结构

```
mindforge/
├── public/                 # 静态资源
├── src/
│   ├── components/         # React 组件
│   │   ├── ui/            # 基础 UI 组件
│   │   └── ...            # 功能组件
│   ├── pages/             # 页面组件
│   ├── stores/            # Zustand 状态管理
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具函数和服务
│   ├── types/             # TypeScript 类型定义
│   ├── App.tsx            # 应用入口
│   ├── main.tsx           # 渲染入口
│   └── index.css          # 全局样式
├── server/
│   ├── db/                # 数据库相关
│   │   ├── connection.js  # 数据库连接
│   │   └── schema.sql     # 表结构
│   ├── routes/            # API 路由
│   └── index.js           # 服务入口
├── docs/                   # 文档
├── docker-compose.yml      # Docker 编排
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 📱 页面说明

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录页 | `/login` | 用户登录/注册 |
| 主页 | `/` | 题库列表、快速开始学习 |
| 题库详情 | `/deck/:id` | 题目列表、统计信息 |
| 练习页 | `/practice` | 答题界面 |
| 导入页 | `/import` | 批量导入题目 |
| 数据面板 | `/dashboard` | 学习数据分析 |

---

## 🔌 API 接口

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新令牌
- `POST /api/auth/logout` - 退出登录

### 题库相关
- `GET /api/decks` - 获取题库列表
- `POST /api/decks` - 创建题库
- `PUT /api/decks/:id` - 更新题库
- `DELETE /api/decks/:id` - 删除题库

### 题目相关
- `GET /api/questions` - 获取题目列表
- `POST /api/questions` - 创建题目
- `POST /api/questions/batch` - 批量导入题目

### 学习相关
- `GET /api/cards` - 获取学习卡片
- `POST /api/cards/review` - 提交复习结果
- `GET /api/stats` - 获取学习统计

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<p align="center">
  Made with ❤️ by MindForge Team
</p>
