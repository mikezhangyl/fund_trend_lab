# Cloudflare 部署指南

## 方案概述

由于 Cloudflare Workers 不支持 Python，我们采用**前后端分离部署**：

- **前端**: Cloudflare Pages（免费 CDN）
- **后端**: Railway/Render（Python FastAPI）
- **数据库**: PostgreSQL

---

## 架构图

```
用户浏览器
    ↓
Cloudflare Pages (前端 React)
    ↓ (API 调用)
Railway/Render (后端 FastAPI)
    ↓
PostgreSQL 数据库
```

---

## 步骤1: 部署后端到 Railway

### 1.1 创建 Railway 服务

1. 访问 [railway.app](https://railway.app)
2. GitHub 登录
3. "New Project" → "Deploy from GitHub repo"
4. 选择你的仓库

### 1.2 配置后端服务

Railway 会自动创建：
- Backend (Python)
- Database (PostgreSQL)

### 1.3 获取后端 URL

部署完成后，在 Railway 控制台找到：
```
https://your-backend.railway.app
```

复制这个 URL，下一步需要用到。

---

## 步骤2: 部署前端到 Cloudflare Pages

### 2.1 准备前端代码

修改 `frontend/src/services/api.ts`，添加环境变量支持：

```typescript
// 在文件顶部添加
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});
```

### 2.2 连接 GitHub 到 Cloudflare Pages

1. 访问 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 登录后，选择 "Workers & Pages"
3. 点击 "Create application" → "Pages" → "Connect to Git"
4. 选择你的 GitHub 仓库

### 2.3 配置构建设置

在 Cloudflare Pages 设置中：

- **Project name**: `fund-trend-lab`
- **Production branch**: `main`
- **Build command**: `cd frontend && npm install && npm run build`
- **Build output directory**: `frontend/dist`

### 2.4 配置环境变量

在 Cloudflare Pages → Settings → Environment variables：

添加环境变量（仅在 Production）：
```
VITE_API_BASE_URL = https://your-backend.railway.app
```
（替换为你的 Railway 后端 URL）

### 2.5 部署

点击 "Save and Deploy"，Cloudflare 会：
1. 从 GitHub 拉取代码
2. 构建前端
3. 部署到全球 CDN

### 2.6 获取前端 URL

部署完成后，你会得到：
```
https://fund-trend-lab.pages.dev
```

---

## 步骤3: 配置 CORS

由于前后端不同域，需要在后端添加 CORS 配置。

### 修改 `backend/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="基金趋势实验室 API")

# 允许的前端域名
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # 本地开发
    "https://fund-trend-lab.pages.dev",  # Cloudflare Pages
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 重新部署后端

提交代码并推送到 GitHub，Railway 会自动重新部署。

---

## 步骤4: 测试部署

1. 访问 Cloudflare Pages URL
2. 检查浏览器控制台是否有错误
3. 测试功能：
   - 查看基金列表
   - 查看图表
   - 添加/删除基金

---

## 成本估算

| 服务 | 免费额度 | 预计费用 |
|------|---------|---------|
| Cloudflare Pages | 无限请求 | **$0** |
| Railway | $5/月额度 | **$0-$5** |
| PostgreSQL (Railway) | 包含在额度内 | **$0** |

**总计**: 对于朋友分享使用，**完全免费** ✅

---

## 优缺点对比

### 优点 ✅

- **前端性能极佳**: Cloudflare 全球 CDN
- **无限带宽**: 不用担心流量费用
- **免费 SSL**: 自动 HTTPS 证书
- **快速部署**: Git 推送自动部署

### 缺点 ❌

- **前后端分离**: 需要两个平台
- **CORS 配置**: 需要处理跨域问题
- **环境变量**: 需要配置两个地方

---

## 常见问题

### 1. API 请求失败

检查：
- CORS 是否正确配置
- 环境变量 `VITE_API_BASE_URL` 是否正确
- 后端服务是否正常运行

### 2. 生产环境 API 调用本地地址

确保使用了 `import.meta.env.VITE_API_BASE_URL`，而不是硬编码的 localhost。

### 3. 构建失败

检查：
- Build command: `cd frontend && npm install && npm run build`
- Output directory: `frontend/dist`

---

## 自动部署配置

### Cloudflare Pages 自动部署

每次推送到 `main` 分支，Cloudflare 自动部署前端。

### Railway 自动部署

每次推送到 `main` 分支，Railway 自动部署后端。

### GitHub Actions（可选）

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Railway
        run: |
          curl -X POST https://railway.app/graphql/v2 \
            -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
            -d '{"query": "mutation { deployProject(input: { projectId: \"YOUR_PROJECT_ID\" }) }"}'
```

---

## 总结

**推荐使用此方案，如果：**
- ✅ 你需要优秀的全球 CDN
- ✅ 前端访问量较大
- ✅ 不介意前后端分离部署

**不推荐此方案，如果：**
- ❌ 你想要一键部署（前后端在同一平台）
- ❌ 你不想处理 CORS 配置
- ❌ 你想要最简单的部署方式

**更简单的替代方案：**
- 直接部署到 Railway（前后端一起）
- 或直接部署到 Render（前后端一起）

参考 `docs/deployment_guide.md` 的 Railway 或 Render 方案。
