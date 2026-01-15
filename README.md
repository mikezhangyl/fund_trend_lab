# 基金趋势实验室 | Fund Trend Lab

一个用于可视化和分析基金净值走势的工具，帮助投资者更好地理解基金表现。

## ✨ 功能特点

- **复权净值计算** - 考虑分红再投资，准确反映真实收益
- **多基金对比** - 一行显示 3 个基金，方便横向对比
- **时间区间选择** - 支持 1年/3年/5年 统一切换
- **基金排序** - 按名称、代码或添加顺序排序
- **沪深300对比** - 灰色虚线显示指数走势，评估相对表现
- **归一化显示** - 起点为 0%，直观对比不同净值的基金
- **🆕 连续上涨阶段检测** - 智能识别上涨趋势，5%回撤容忍
- **🆕 急涨事件标注** - 图表上绿色/红色区域标注上涨阶段
- **🆕 斜率可视化** - 显示上涨速度和加速度（🚀）
- **🆕 图表放大** - 点击图表全屏查看细节

## 🖼️ 界面预览

- 固定顶部 Header，滚动时始终可见
- 输入基金代码快速添加
- 支持删除已添加的基金

## 🚀 快速开始

### 前置要求

- Python 3.9+
- Node.js 18+
- npm

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/mikezhangyl/fund_trend_lab.git
cd fund_trend_lab
```

2. **启动后端**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

3. **启动前端**
```bash
cd frontend
npm install
npm run dev
```

4. **访问应用**
打开浏览器访问 http://localhost:5173

## 📦 技术栈

### 后端
- **FastAPI** - Python Web 框架
- **SQLite** - 本地数据存储
- **AKShare** - 中国金融数据接口

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **ECharts** - 图表库
- **Vite** - 构建工具

## 📝 使用说明

1. 在顶部输入框输入基金代码（如 `000001`）
2. 点击"添加"按钮或按 Enter 键
3. 系统会自动获取基金信息和历史净值
4. 使用时间选择器切换显示区间
5. 使用排序按钮调整显示顺序

## 📄 License

MIT License
