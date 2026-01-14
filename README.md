# 基金趋势实验室 | Fund Trend Lab

**v1.1** - 基金多时间区间趋势可视化工具

一个本地优先的单用户工具，用于直观对比和分析基金/ETF的多时间区间趋势。

## 核心特性

- **多时间区间并列展示**：每只基金横向展示3张折线图（1年、6个月、1个月）
- **跨图同步时间线**：鼠标悬停时，所有图表自动对齐到同一天
- **时间线锁定**：点击可锁定时间线，显示相对于锁定日的极值百分比变化
- **指数对比基准**：每张基金图叠加指数线（默认沪深300）
- **本地数据库缓存**：使用SQLite存储，支持离线查看
- **后台异步同步**：自动从AKShare更新数据，不阻塞UI
- **状态持久化**：重启后恢复基金列表和UI配置

## 技术架构

### 后端
- **框架**：FastAPI（异步Python Web框架）
- **数据库**：SQLite（本地Single Source of Truth）
- **数据源**：AKShare（中国金融数据接口）
- **架构**：UI → 仅读本地数据库 | 后台 → 异步更新数据库

### 前端
- **框架**：React 18 + TypeScript
- **图表库**：uPlot（高性能Canvas时间序列图表）
- **构建工具**：Vite

## 安装和运行

### 环境要求
- Python 3.9+
- Node.js 16+
- npm 或 yarn

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 启动后端服务

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

后端API将在 `http://localhost:8000` 启动

### 4. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端应用将在 `http://localhost:5173` 启动

## 使用说明

### 添加基金
1. 在顶部输入框输入基金代码（如：000001）
2. 点击"添加"按钮或按回车
3. 系统会自动同步基金数据，首次加载可能需要几秒钟

### 交互操作
- **鼠标悬停**：查看同一天所有基金的数据
- **左键点击**：锁定时间线，显示相对于锁定日的极值百分比变化
- **再次点击**：解锁时间线

### 时间区间
默认提供3个时间区间：
- 1年（365天）
- 6个月（180天）
- 1个月（30天）

## 项目结构

```
fund_trend_lab/
├── backend/
│   ├── main.py                  # FastAPI主应用
│   ├── database.py              # SQLite数据库模块
│   ├── requirements.txt         # Python依赖
│   └── services/
│       ├── data_fetcher.py      # AKShare数据摄取
│       └── sync_service.py      # 后台同步服务
├── frontend/
│   ├── src/
│   │   ├── components/          # React组件
│   │   │   ├── TrendChart.tsx   # uPlot图表组件
│   │   │   └── FundRow.tsx      # 基金行组件
│   │   ├── hooks/               # 自定义Hook
│   │   │   ├── useAppState.tsx  # 状态管理
│   │   │   └── useChartData.tsx # 图表数据
│   │   ├── services/
│   │   │   └── api.ts           # API服务层
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript类型定义
│   │   ├── App.tsx              # 主应用
│   │   └── main.tsx             # 入口文件
│   ├── package.json             # Node依赖
│   └── vite.config.ts           # Vite配置
└── data/
    └── fund_trend.db            # SQLite数据库（运行时生成）
```

## 数据架构原则

遵循PRD v1.1规范：

1. **Single Source of Truth**：所有数据存储在本地SQLite数据库
2. **UI层只读**：前端不直接访问AKShare，仅读取本地数据库
3. **后台异步同步**：数据更新不影响UI响应
4. **增量更新**：仅同步新数据，避免重复拉取

## 数据库表结构

- `instrument`：基金/指数基本信息
- `timeseries_daily`：日频时间序列数据
- `sync_state`：同步状态记录
- `user_state`：用户UI状态持久化

## API端点

### 基金/指数管理
- `GET /api/instruments` - 获取所有基金/指数
- `GET /api/instruments/{code}` - 获取单个基金/指数详情
- `POST /api/instruments` - 添加基金/指数

### 时间序列数据
- `POST /api/timeseries` - 查询时间序列数据
- `GET /api/timeseries/{code}/range/{days}` - 按天数范围查询

### 数据同步
- `POST /api/sync` - 触发后台同步
- `GET /api/sync/status/{code}` - 获取同步状态
- `GET /api/sync/syncing` - 获取正在同步的代码列表

### 用户状态
- `POST /api/state` - 保存用户状态
- `GET /api/state/{key}` - 加载用户状态

## 性能指标

- 首只基金 ≤ 3秒可见
- 支持 ≥10 只基金并行展示
- 单基金失败不影响整体
- 跨图时间线严格对齐

## 开发路线图

### v1.1（当前版本）
- ✅ 核心数据架构（SQLite + AKShare）
- ✅ 多时间区间图表展示
- ✅ 跨图同步时间线
- ✅ 极值与百分比计算
- ✅ 状态持久化

### 未来版本（非v1.1范围）
- 图片识别导入基金（OCR）
- 自定义指标体系
- 数据导出功能
- AI分析与总结

## 许可证

MIT License

## 致谢

- [AKShare](https://akshare.akfamily.xyz/) - 中国金融数据接口
- [uPlot](https://github.com/leeoniya/uPlot) - 高性能时间序列图表库
- [FastAPI](https://fastapi.tiangolo.com/) - 现代化Python Web框架
