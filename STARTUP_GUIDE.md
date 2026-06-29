# 🚀 快速启动与故障排除指南 | Startup & Troubleshooting Guide

## 1. 快速启动 (Recommended)

使用一键启动脚本，自动启动 Backend (8000) 和 Frontend (5173)：

```bash
./start.sh
```

---

## 2. 常见问题：端口被占用 (Address already in use)

如果启动时遇到 `[Errno 48] Address already in use` 错误，说明后台服务没有正常关闭。请按以下步骤强制清理：

### 🧹 一键清理脚本
直接复制并在 Terminal 中运行：

```bash
# 杀掉占用 8000 (Backend) 和 5173 (Frontend) 端口的所有进程
lsof -ti :8000,5173 | xargs kill -9
```

或者使用 `pkill` (杀掉所有相关进程):

```bash
pkill -f "uvicorn main:app"
pkill -f "vite"
```

清理完成后，再次运行 `./start.sh` 即可。

---

## 3. 手动分别启动 (Manual Start)

如果您想在两个 Terminal 窗口分别控制：

**Terminal 1: Backend**
```bash
cd backend
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
```

**Terminal 3: 扫描监控 (可选)**
```bash
./monitor_scan.sh
```
