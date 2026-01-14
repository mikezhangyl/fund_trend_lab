#!/bin/bash

echo "🚀 启动基金趋势实验室..."

# 检查Python和Node是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3，请先安装Python 3.9+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到npm，请先安装Node.js 16+"
    exit 1
fi

# 检查后端依赖
if [ ! -d "backend/venv" ]; then
    echo "📦 安装后端依赖..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend
    npm install
    cd ..
fi

# 创建数据目录
mkdir -p data

echo "✅ 依赖检查完成"
echo ""
echo "正在启动服务..."
echo "  - 后端: http://localhost:8000"
echo "  - 前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 启动后端和前端（并行）
cd "$(pwd)/backend" && source venv/bin/activate && python -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

cd "$(pwd)/frontend" && npm run dev &
FRONTEND_PID=$!

# 等待进程
wait $BACKEND_PID $FRONTEND_PID
