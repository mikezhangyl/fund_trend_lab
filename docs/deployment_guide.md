# 部署指南 - Serverless 平台

## 概述

本指南帮助你将基金趋势实验室部署到免费的 Serverless 平台，让朋友也能访问。

---

## 推荐平台对比

| 平台 | 免费额度 | 冷启动 | 国内访问 | 难度 | 推荐度 |
|------|---------|--------|---------|------|--------|
| **Render** | 750小时/月 | 慢(30s) | 一般 | ⭐ | ⭐⭐⭐⭐⭐ |
| **Railway** | $5/月 | 快(5s) | 一般 | ⭐ | ⭐⭐⭐⭐⭐ |
| **Fly.io** | 3个小VM | 快 | 慢 | ⭐⭐ | ⭐⭐⭐⭐ |
| **Zeabur** | 有限 | 快 | **快** | ⭐ | ⭐⭐⭐⭐ |

---

## 方案1: Render（最简单）

### 步骤1: 准备代码

```bash
# 1. 确保 .gitignore 包含：
echo "backend/venv
__pycache__
*.db
frontend/node_modules
frontend/dist
.env
" >> .gitignore

# 2. 提交代码到 GitHub
git add .
git commit -m "准备部署到 Render"
git push origin main
```

### 步骤2: 部署后端

1. 访问 [render.com](https://render.com)
2. 使用 GitHub 账号登录
3. 点击 "New +" → "Web Service"
4. 选择你的 GitHub 仓库
5. 配置：
   - **Name**: fund-trend-lab-backend
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. 点击 "Create Web Service"

### 步骤3: 创建数据库

1. 在 Render 控制台点击 "New +" → "PostgreSQL"
2. 配置：
   - **Name**: fund-trend-lab-db
   - **Database**: fund_trend_lab
   - **User**: fund_user
3. 创建后，复制 "Internal Database URL"
4. 回到后端服务，添加环境变量：
   - **Key**: `DATABASE_URL`
   - **Value**: 粘贴刚才的 URL

### 步骤4: 部署前端

1. 在 Render 点击 "New +" → "Static Site"
2. 选择同一个 GitHub 仓库
3. 配置：
   - **Name**: fund-trend-lab-frontend
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. 添加环境变量：
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://fund-trend-lab-backend.onrender.com`（替换为你的后端 URL）

### 步骤5: 访问应用

部署完成后（约5-10分钟），你会得到两个 URL：
- 后端: `https://fund-trend-lab-backend.onrender.com`
- 前端: `https://fund-trend-lab-frontend.onrender.com`

分享前端的 URL 给朋友即可！

---

## 方案2: Railway（推荐）

### 步骤1: 访问 Railway

1. 访问 [railway.app](https://railway.app)
2. 点击 "Login with GitHub"
3. 点击 "New Project" → "Deploy from GitHub repo"

### 步骤2: 选择仓库

Railway 会自动检测你的项目结构并创建三个服务：
- Backend (Python)
- Frontend (Node.js)
- Database (PostgreSQL)

### 步骤3: 配置环境变量

在 Backend 服务中添加：
```
DATABASE_URL = {{database.RAILWAY_PRIVATE_DATABASE_URL}}
```

在 Frontend 服务中添加：
```
VITE_API_BASE_URL = {{backend.RAILWAY_PUBLIC_DOMAIN}}
```

### 步骤4: 部署

点击 "Deploy" 按钮，Railway 会自动：
1. 安装依赖
2. 构建项目
3. 启动服务
4. 生成公网 URL

### 步骤5: 获取 URL

在 Railway 控制台可以看到：
- 后端 URL: `https://your-backend.railway.app`
- 前端 URL: `https://your-frontend.railway.app`

---

## 方案3: Zeabur（国内友好）

如果你的朋友主要在中国大陆，推荐使用 Zeabur：

### 步骤1: 访问 Zeabur

1. 访问 [zeabur.com](https://zeabur.com)
2. 使用 GitHub 登录

### 步骤2: 创建项目

1. 点击 "New Project"
2. 选择 "Deploy from GitHub"
3. 选择你的仓库

### 步骤3: 添加服务

Zeabur 会自动检测并创建：
- Prebuilt Service (后端)
- Prebuilt Service (前端)
- PostgreSQL (数据库)

### 步骤4: 配置环境变量

在服务设置中添加环境变量（参考 Railway 方案）

### 步骤5: 部署

点击 "Deploy"，Zeabur 会提供：
- 国内访问速度快的域名
- 自动 HTTPS 证书

---

## 数据库迁移注意

由于你目前使用 SQLite，部署时需要迁移到 PostgreSQL：

### 修改 `backend/database.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

# 使用环境变量中的数据库 URL
DATABASE_URL = os.getenv('DATABASE_URL', 'fund_trend_lab.db')

if DATABASE_URL.startswith('postgresql://'):
    # PostgreSQL (生产环境)
    import psycopg2
    from psycopg2 import sql

    def get_db():
        conn = psycopg2.connect(DATABASE_URL)
        return conn
else:
    # SQLite (本地开发)
    def get_db():
        conn = sqlite3.connect(DATABASE_URL)
        conn.row_factory = sqlite3.Row
        return conn
```

### 添加依赖到 `requirements.txt`

```
psycopg2-binary>=2.9.0
python-dotenv>=1.0.0
```

### 创建 `.env` 文件

```bash
# 本地开发使用 SQLite
DATABASE_URL=fund_trend_lab.db
```

---

## 成本对比

| 平台 | 免费套餐 | 超出后费用 |
|------|---------|-----------|
| Render | 750小时/月 | $7/月起 |
| Railway | $5/月额度 | 按使用量付费 |
| Fly.io | 3个免费VM | $5-10/月 |
| Zeabur | 有限额度 | 按使用量付费 |

**估算：**
- 如果是朋友间分享（<100 访问/天）：**完全免费**
- 如果是小规模公开（<1000 访问/天）：**月费 $5-10**

---

## 常见问题

### 1. 冷启动问题

免费服务在15分钟无访问后会休眠，下次访问需要30秒左右唤醒。

**解决方法：**
- 使用 UptimeRobot 定时 ping（每5分钟）
- 或者升级到付费套餐

### 2. 域名配置

所有平台都支持自定义域名：

```bash
# 在你的域名 DNS 添加 CNAME 记录
frontend.yourdomain.com → frontend.onrender.com
```

### 3. CORS 问题

如果前端访问后端遇到 CORS 错误，在 `backend/main.py` 添加：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 推荐部署流程

**对于个人项目/朋友分享：**

1. 使用 **Railway** 或 **Render**（免费）
2. 使用提供的免费域名
3. 定期访问防止休眠

**对于正式生产环境：**

1. 使用 **Railway**（付费，稳定性好）
2. 绑定自定义域名
3. 设置监控和告警
4. 配置自动备份

---

## 一键部署脚本

创建 `.github/workflows/deploy.yml` 实现自动部署：

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railwayapp/cli@latest
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          command: railway up
```

这样每次 `git push` 后自动部署！

---

## 总结

**最快上手：** Render（5分钟部署完成）
**用户体验：** Railway（冷启动快）
**国内访问：** Zeabur
**完全免费：** Render 或 Railway（免费额度）

选择一个平台试试吧！有任何问题随时问我。
