"""
FastAPI后端主应用
提供基金数据查询、同步、状态管理API
遵循PRD v1.1：UI仅读取本地数据库，后台异步同步
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import asyncio

from database import (
    init_database,
    get_instrument_info,
    list_instruments,
    get_timeseries,
    upsert_instrument,
    delete_instrument,
    save_user_state,
    load_user_state,
    get_sync_state
)
from services.data_fetcher import DataFetcher
from services.sync_service import sync_service
from services.indicators import indicator_service


app = FastAPI(
    title="Fund Trend Lab API",
    description="基金多时间区间趋势可视化工具 - 后端API",
    version="1.1.0"
)

# 添加CORS支持（允许前端跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 启动时初始化数据库
@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    init_database()
    print("Database initialized.")


# ==================== Pydantic模型 ====================

class Instrument(BaseModel):
    """基金/指数信息"""
    code: str
    name: str
    type: str  # 'fund', 'etf', 'index'


class TimeRange(BaseModel):
    """时间区间"""
    days: int
    label: Optional[str] = None


class TimeseriesRequest(BaseModel):
    """时间序列查询请求"""
    code: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class SyncRequest(BaseModel):
    """同步请求"""
    codes: List[str]


class UserState(BaseModel):
    """用户状态"""
    key: str
    value: str


# ==================== 基金/指数管理 ====================

@app.get("/api/instruments")
async def get_instruments(instrument_type: Optional[str] = None) -> List[Instrument]:
    """
    获取所有基金/指数列表

    Args:
        instrument_type: 筛选类型 (fund/etf/index)

    Returns:
        基金/指数列表
    """
    try:
        instruments = list_instruments(instrument_type)
        return [
            Instrument(
                code=inst["code"],
                name=inst["name"],
                type=inst["type"]
            )
            for inst in instruments
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/instruments/{code}")
async def get_instrument_detail(code: str) -> Instrument:
    """
    获取单个基金/指数详情

    Args:
        code: 基金/指数代码

    Returns:
        基金/指数信息
    """
    try:
        info = get_instrument_info(code)

        # 如果数据库中不存在，尝试从AKShare获取
        if not info:
            print(f"Instrument {code} not found in database, fetching from AKShare...")
            fetcher = DataFetcher()
            info = fetcher.fetch_fund_info(code)

            if not info:
                raise HTTPException(status_code=404, detail=f"Instrument {code} not found")

        return Instrument(
            code=info["code"],
            name=info["name"],
            type=info["type"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/indicators/{code}")
async def get_indicators(code: str, days: int = 20) -> Dict:
    """
    获取基金技术指标
    
    用于识别潜在急涨信号，包含：
    - momentum: 动量（涨跌幅%）
    - relative_strength: 相对强度（vs沪深300）
    - volatility: 波动率
    - vol_ratio: 波动率压缩比
    - warning_level: 预警等级 (HIGH/MEDIUM/LOW)
    
    Args:
        code: 基金代码
        days: 计算周期天数（默认20）
    """
    try:
        result = indicator_service.calculate_indicators(code, days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/instruments")
async def add_instrument(instrument: Instrument) -> Dict:
    """
    添加基金/指数

    Args:
        instrument: 基金/指数信息

    Returns:
        操作结果
    """
    try:
        upsert_instrument(
            code=instrument.code,
            name=instrument.name,
            instrument_type=instrument.type
        )

        return {
            "success": True,
            "message": f"Instrument {instrument.code} added successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/instruments/{code}")
async def remove_instrument(code: str) -> Dict:
    """
    删除基金/指数及其所有数据

    Args:
        code: 基金/指数代码

    Returns:
        删除结果
    """
    try:
        # 检查基金是否存在
        info = get_instrument_info(code)
        if not info:
            raise HTTPException(status_code=404, detail=f"Instrument {code} not found")

        # 执行删除
        result = delete_instrument(code)

        return {
            "success": True,
            "message": f"Instrument {code} deleted successfully",
            "details": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 时间序列数据 ====================

@app.post("/api/timeseries")
async def get_timeseries_data(request: TimeseriesRequest) -> List[Dict]:
    """
    获取时间序列数据

    Args:
        request: 包含code、start_date、end_date的请求

    Returns:
        时间序列数据列表 [{date, value}]
    """
    try:
        data = get_timeseries(
            code=request.code,
            start_date=request.start_date,
            end_date=request.end_date
        )

        return [
            {
                "date": item["date"],
                "value": item["value"]
            }
            for item in data
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/timeseries/{code}/range/{days}")
async def get_timeseries_by_range(
    code: str,
    days: int,
    end_date: Optional[str] = None
) -> List[Dict]:
    """
    按天数范围获取时间序列数据

    Args:
        code: 基金/指数代码
        days: 天数（如365表示1年）
        end_date: 结束日期，默认为今天

    Returns:
        时间序列数据列表
    """
    try:
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")

        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        data = get_timeseries(code, start_date, end_date)

        return [
            {
                "date": item["date"],
                "value": item["value"]
            }
            for item in data
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 数据同步 ====================

@app.post("/api/sync")
async def sync_instruments(request: SyncRequest, background_tasks: BackgroundTasks) -> Dict:
    """
    同步基金/指数数据（后台异步）

    Args:
        request: 包含codes列表的请求
        background_tasks: FastAPI后台任务

    Returns:
        同步任务信息
    """
    try:
        # 启动后台同步任务
        async def sync_task():
            results = await sync_service.sync_multiple(request.codes)
            print(f"Sync completed: {len([r for r in results if r['success']])}/{len(results)} succeeded")

        background_tasks.add_task(sync_task)

        return {
            "success": True,
            "message": f"Sync task started for {len(request.codes)} instruments",
            "codes": request.codes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sync/status/{code}")
async def get_sync_status(code: str) -> Dict:
    """
    获取同步状态

    Args:
        code: 基金/指数代码

    Returns:
        同步状态信息
    """
    try:
        status = get_sync_state(code)
        if not status:
            return {
                "code": code,
                "synced": False,
                "message": "Not synced yet"
            }

        return {
            "code": code,
            "synced": True,
            "last_success_date": status["last_success_date"],
            "last_sync_at": status["last_sync_at"],
            "status": status["status"],
            "message": status["message"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sync/syncing")
async def get_syncing_list() -> List[str]:
    """
    获取正在同步的代码列表

    Returns:
        正在同步的代码列表
    """
    return list(sync_service.syncing)


# ==================== 用户状态管理 ====================

@app.post("/api/state")
async def save_state(state: UserState) -> Dict:
    """
    保存用户状态

    Args:
        state: 包含key和value的状态

    Returns:
        操作结果
    """
    try:
        save_user_state(state.key, state.value)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/state/{key}")
async def load_state(key: str) -> Dict:
    """
    加载用户状态

    Args:
        key: 状态键

    Returns:
        状态值
    """
    try:
        value = load_user_state(key)
        if value is None:
            raise HTTPException(status_code=404, detail=f"State {key} not found")

        return {"key": key, "value": value}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 健康检查 ====================

@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn

    # 运行服务器
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
