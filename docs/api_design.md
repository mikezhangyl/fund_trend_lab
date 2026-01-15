# Fund Trend Lab API 文档

> 版本: v1.2.0 | 更新时间: 2026-01-15

## 概述

Fund Trend Lab 后端 API 提供基金数据查询、管理、同步和收藏功能。

**Base URL**: `http://localhost:8000`

---

## API 目录

### 基金管理
- [POST /api/funds/batch](./funds.md#批量添加基金) - 批量添加基金
- [GET /api/instruments](./funds.md#获取基金列表) - 获取基金列表
- [GET /api/instruments/{code}](./funds.md#获取单个基金信息) - 获取单个基金信息
- [POST /api/instruments](./funds.md#添加单个基金) - 添加单个基金
- [DELETE /api/instruments/{code}](./funds.md#删除基金) - 删除基金

### 收藏管理
- [GET /api/favorites](./favorites.md#获取收藏列表) - 获取收藏列表
- [POST /api/favorites](./favorites.md#设置收藏) - 设置/更新收藏

### 数据查询
- [GET /api/timeseries/{code}/range/{days}](./timeseries.md) - 获取时间序列数据
- [GET /api/indicators/{code}](./indicators.md) - 获取技术指标
- [GET /api/surge_events/{code}](./events.md) - 获取急涨事件
- [GET /api/uptrend_phases/{code}](./events.md) - 获取上涨阶段

### 数据同步
- [POST /api/sync](./sync.md) - 同步基金数据

### 系统
- [GET /api/health](./system.md) - 健康检查

---

## 快速开始

### 1. 添加基金并设为收藏
```bash
curl -X POST http://localhost:8000/api/funds/batch \
  -H "Content-Type: application/json" \
  -d '{
    "codes": ["005903", "011373", "023394"],
    "set_favorite": true,
    "sync_data": true
  }'
```

### 2. 获取收藏列表
```bash
curl http://localhost:8000/api/favorites
```

### 3. 获取基金时间序列
```bash
curl http://localhost:8000/api/timeseries/005903/range/365
```

---

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应
```json
{
  "detail": "错误描述"
}
```

---

## 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
