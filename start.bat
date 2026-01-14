@echo off
echo 🚀 启动基金趋势实验室...

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Python，请先安装Python 3.9+
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到npm，请先安装Node.js 16+
    pause
    exit /b 1
)

REM 检查后端依赖
if not exist "backend\venv" (
    echo 📦 安装后端依赖...
    cd backend
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd ..
)

REM 检查前端依赖
if not exist "frontend\node_modules" (
    echo 📦 安装前端依赖...
    cd frontend
    npm install
    cd ..
)

REM 创建数据目录
if not exist "data" mkdir data

echo ✅ 依赖检查完成
echo.
echo 正在启动服务...
echo   - 后端: http://localhost:8000
echo   - 前端: http://localhost:5173
echo.
echo 按Ctrl+C停止所有服务
echo.

REM 启动后端
start "Fund Trend Lab - Backend" /D backend\venv\Scripts python -m uvicorn main:app --reload --port 8000

REM 启动前端
start "Fund Trend Lab - Frontend" cmd /K "cd frontend && npm run dev"

echo.
echo 服务已启动！
pause
