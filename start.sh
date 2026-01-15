#!/bin/bash

echo "🚀 启动基金趋势实验室..."

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "📦 创建后端虚拟环境..."
    cd "$SCRIPT_DIR/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
fi

# 检查前端依赖
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd "$SCRIPT_DIR/frontend"
    npm install
fi

# 创建数据目录
mkdir -p "$SCRIPT_DIR/data"

echo "✅ 依赖检查完成"
echo ""
echo "正在启动服务..."
echo "  - 后端: http://localhost:8000"
echo "  - 前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# 启动后端
(cd "$SCRIPT_DIR/backend" && source venv/bin/activate && python -m uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端
(cd "$SCRIPT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

echo "✅ 服务已启动"
echo "   后端PID: $BACKEND_PID"
echo "   前端PID: $FRONTEND_PID"
echo ""

# 等待进程
wait $BACKEND_PID $FRONTEND_PID
