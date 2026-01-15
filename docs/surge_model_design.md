# 急涨趋势检测模型设计文档

> 版本: v1.0
> 更新日期: 2026-01-15
> 作者: Fund Trend Lab Team

---

## 1. 概述

### 1.1 目标

构建一个基于历史净值数据的急涨趋势检测系统，能够：
- **识别** 已发生的急涨事件（回测）
- **分析** 急涨事件的共性特征
- **预警** 潜在的急涨信号（未来扩展）

### 1.3 核心思路
 
采用 **双模态检测**：
1. **固定窗口检测 (SurgeEvent)**: 使用 10/20/30 天固定窗口，识别爆发性急涨 (原有算法)
2. **连续趋势检测 (UptrendPhase)**: 动态跟踪上涨趋势，允许小幅回撤 (新算法)

#### 1.3.1 连续趋势检测原理
捕捉完整的上涨波段，而不是被固定时间窗口限制。允许期间有 5% 以内的回撤，视作同一波上涨；一旦回撤超过 5%，则认定该波段结束。

---

## 2. 数学模型

### 2.1 固定窗口急涨检测 (SurgeEvent)

**斜率计算:**
对于包含 N 个数据点的窗口，将其分为前后两段：

**前半段斜率 (slope₁):**
$$
y = \frac{P_t - P_0}{P_0} \times 100\%
$$
$$
slope_1 = \frac{\sum_{i=0}^{m-1}(i - \bar{x})(y_i - \bar{y})}{\sum_{i=0}^{m-1}(i - \bar{x})^2}
$$

其中 $m = N / 2$，$P_t$ 为第 t 天净值，$P_0$ 为起始日净值。

**后半段斜率 (slope₂):**
以中点为新起点，对后半段数据进行同样的线性回归。

**加速度:**
$$
acceleration = \frac{slope_2}{slope_1}
$$

### 2.2 连续上涨阶段检测 (UptrendPhase)

**动态波段识别:**
1. **起点**: 当日收盘价 > 前一日收盘价
2. **峰值更新**: 记录该波段至今的最高价 $P_{max}$
3. **动态回撤计算**:
   $$
   Drawdown_t = \frac{P_{max} - P_t}{P_{max}} \times 100\%
   $$
4. **终点判定**: 当 $Drawdown_t > Threshold$ (默认 5%) 时，波段结束。
   - 结束点定为 $P_{max}$ 发生的那一天（剔除回撤部分）

**有效性过滤:**
- 总涨幅 $\ge$ 10%
- 持续时间 $\ge$ 5天

### 2.3 急涨判定条件

同时满足以下条件时，判定为急涨事件：

同时满足以下条件时，判定为急涨事件：

```python
is_surge = (
    total_gain >= MIN_GAIN and        # 总涨幅 ≥ 15%
    avg_slope >= MIN_SLOPE and        # 日均斜率 ≥ 0.3%/天
    slope_second > 0                   # 后半段仍在上涨
)
```

---

## 3. 参数配置

### 3.1 检测参数

| 参数 | 默认值 | 说明 | 调优建议 |
|------|--------|------|----------|
| `windows` | [10, 20, 30] | 观察窗口(交易日) | 短窗口捕捉短期急涨，长窗口捕捉趋势性上涨 |
| `min_gain` | 15.0% | 最小总涨幅 | 降低可增加灵敏度，但可能增加噪声 |
| `min_slope` | 0.3%/天 | 最小日均斜率 | 过滤缓慢上涨的情况 |
| `acceleration_threshold` | 1.3 | 加速判定阈值 | 大于此值标记为加速上涨 |

### 3.2 参数选择依据

- **10天窗口**: 捕捉短期暴涨，如政策利好、业绩超预期
- **20天窗口**: 约一个月交易日，反映中短期趋势
- **30天窗口**: 反映持续性上涨趋势

---

## 4. 特征工程

### 4.1 当前使用的特征

| 特征 | 计算方法 | 用途 |
|------|----------|------|
| 总涨幅 | (末值 - 首值) / 首值 × 100% | 判定急涨幅度 |
| 前段斜率 | 前半段线性回归斜率 | 分析启动阶段 |
| 后段斜率 | 后半段线性回归斜率 | 分析加速阶段 |
| 加速度 | 后段斜率 / 前段斜率 | 判定趋势变化 |

### 4.2 辅助预测特征（来自 indicators.py）

| 特征 | 说明 | 预警价值 |
|------|------|----------|
| **相对强度 (RS)** | 基金涨幅 - 沪深300涨幅 | RS 持续 > 0 表示强势 |
| **动量** | 近20日涨幅 | 动量 > 10% 表示上涨动能强 |
| **波动率压缩比** | 近期波动率 / 前期波动率 | < 0.8 表示蓄势待发 |

### 4.3 潜在扩展特征

| 特征类别 | 具体特征 | 数据来源 |
|----------|----------|----------|
| 资金流向 | 主力净流入、散户净流出 | 需扩展数据源 |
| 市场情绪 | 相关指数表现、板块热度 | 需扩展数据源 |
| 基本面 | 持仓行业PE、估值分位 | 需扩展数据源 |

---

## 5. 回测结果分析

### 5.1 统计概览

基于当前数据库的回测结果：

| 指标 | 数值 |
|------|------|
| 总事件数 | 5,851 |
| 加速上涨事件 | 3,071 (52.5%) |
| 覆盖基金数 | 50+ |

### 5.2 Top 急涨基金类型

从回测报告分析，以下类型基金急涨频率最高：

| 类型 | 代表基金 | 特点 |
|------|----------|------|
| 科技主题 | 人工智能、半导体 | 受政策和概念驱动 |
| 游戏动漫 | 游戏ETF、动漫ETF | 周期性爆发 |
| 券商 | 证券公司指数 | 牛市先锋 |
| 创新药 | 港股通创新药 | 事件驱动型 |

### 5.3 典型急涨模式

```
模式1: 政策驱动型 (2024-09 半导体)
├─ 窗口: 30天
├─ 涨幅: 50-80%
├─ 特点: 前段慢后段快 (加速)
└─ 案例: 华夏国证半导体ETF联接C (+74.5%)

模式2: 趋势延续型 (2025-07 科技)
├─ 窗口: 30天
├─ 涨幅: 55-65%
├─ 特点: 持续加速上涨
└─ 案例: 永赢科技智选混合发起A (+64.9%)
```

---

## 6. 代码实现

### 6.1 核心类结构

```
backend/services/backtester.py
├── SurgeEvent (数据类)
│   ├── code, name, start_date, end_date
│   ├── window, total_gain
│   ├── slope_first, slope_second
│   └── acceleration, is_accelerating
│
├── UptrendPhase (数据类 - 新增)
│   ├── start_idx, end_idx, duration_days
│   ├── max_drawdown, peak_gain, peak_date
│   └── slope_first, slope_second, is_accelerating
│
├── SurgeDetector (固定窗口检测器)
│   ├── calculate_segment_slopes()
│   ├── is_surge()
│   └── scan_fund()
│
├── UptrendPhaseDetector (连续趋势检测器 - 新增)
│   ├── detect_phases()
│   ├── _calculate_max_drawdown()
│   └── _calculate_segment_slopes()
│
└── SurgeBacktester (回测引擎)
    ├── scan_all_funds()
    ├── generate_report()
    └── save_to_database()
```

### 6.2 API 接口

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/surge-events` | GET | 获取急涨事件列表 |
| `/api/surge-events/{code}` | GET | 获取特定基金的急涨事件 |

---

## 7. 可视化设计

### 7.1 当前实现

- **急涨区域标注**: 使用 ECharts `markArea` 在图表上高亮急涨时间段
- **颜色**: 半透明红色背景 `rgba(239, 68, 68, 0.15)`

### 7.2 计划增强

1. **斜率趋势线**: 使用 `markLine` 显示前/后半段回归线
2. **斜率数值标签**: 标注 "X.XX%/天"
3. **加速图标**: 🚀 标识加速上涨事件

---

## 8. 未来扩展方向

### 8.1 机器学习预测

使用历史急涨事件训练分类器：
- **特征**: RS、动量、波动率压缩比、历史急涨次数
- **标签**: 未来N天是否发生急涨
- **算法**: XGBoost / LightGBM

### 8.2 实时预警系统

```
数据流: AKShare → 数据库 → 特征计算 → 模型推理 → 预警通知
```

设计预警等级：
| 等级 | 条件 | 行动 |
|------|------|------|
| 🟢 低 | score 2-3 | 纳入观察 |
| 🟡 中 | score 4-5 | 密切关注 |
| 🔴 高 | score ≥ 6 | 立即提醒 |

### 8.3 跨基金验证框架

详见 `docs/validation_framework.md`

---

## 9. 参考文献

- Momentum Strategies in Finance
- Technical Analysis and Statistical Methods
- Time Series Regression for Financial Data

---

## 附录: 数据库表结构

```sql
-- 急涨事件表
CREATE TABLE surge_events (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    window INTEGER,
    total_gain REAL,
    slope_first REAL,
    slope_second REAL,
    is_accelerating INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```
