"""
本地数据库模块 - SQLite作为Single Source of Truth
遵循PRD v1.1第3、4章节的数据架构规范
"""
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
from contextlib import contextmanager

# 数据库路径
DB_PATH = Path(__file__).parent.parent / "data" / "fund_trend.db"


@contextmanager
def get_db():
    """获取数据库连接上下文管理器"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 返回字典格式
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """初始化数据库表结构"""
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. instrument 表 - 存储基金/指数基本信息
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS instrument (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('fund', 'etf', 'index')),
                source TEXT NOT NULL DEFAULT 'akshare',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. timeseries_daily 表 - 存储日频时间序列数据
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS timeseries_daily (
                code TEXT NOT NULL,
                date TEXT NOT NULL,
                value REAL NOT NULL,
                source_version TEXT DEFAULT 'v1',
                PRIMARY KEY (code, date),
                FOREIGN KEY (code) REFERENCES instrument(code) ON DELETE CASCADE
            )
        """)

        # 为时间序列查询创建索引
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timeseries_code_date
            ON timeseries_daily(code, date DESC)
        """)

        # 3. sync_state 表 - 记录同步状态
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_state (
                code TEXT PRIMARY KEY,
                last_success_date TEXT,
                last_sync_at TIMESTAMP,
                status TEXT CHECK(status IN ('success', 'failed', 'pending')),
                message TEXT,
                FOREIGN KEY (code) REFERENCES instrument(code) ON DELETE CASCADE
            )
        """)

        # 4. user_state 表 - 存储用户UI状态
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 5. surge_events 表 - 存储急涨事件
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS surge_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                window INTEGER NOT NULL,
                total_gain REAL NOT NULL,
                slope_first REAL,
                slope_second REAL,
                is_accelerating INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code, start_date, end_date),
                FOREIGN KEY (code) REFERENCES instrument(code) ON DELETE CASCADE
            )
        """)

        print(f"Database initialized at: {DB_PATH}")


def get_instrument_info(code: str) -> Optional[Dict]:
    """获取基金/指数信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM instrument WHERE code = ?", (code,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_instruments(
    instrument_type: Optional[str] = None
) -> List[Dict]:
    """列出所有基金/指数"""
    with get_db() as conn:
        cursor = conn.cursor()
        if instrument_type:
            cursor.execute(
                "SELECT * FROM instrument WHERE type = ? ORDER BY code",
                (instrument_type,)
            )
        else:
            cursor.execute("SELECT * FROM instrument ORDER BY code")
        return [dict(row) for row in cursor.fetchall()]


def get_timeseries(
    code: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> List[Dict]:
    """获取时间序列数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM timeseries_daily WHERE code = ?"
        params = [code]

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        query += " ORDER BY date ASC"

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def upsert_instrument(
    code: str,
    name: str,
    instrument_type: str,
    source: str = "akshare"
) -> None:
    """插入或更新基金/指数信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO instrument (code, name, type, source, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                source = excluded.source,
                updated_at = CURRENT_TIMESTAMP
        """, (code, name, instrument_type, source))


def upsert_timeseries(
    code: str,
    date: str,
    value: float,
    source_version: str = "v1"
) -> None:
    """插入或更新时间序列数据点"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO timeseries_daily (code, date, value, source_version)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(code, date) DO UPDATE SET
                value = excluded.value,
                source_version = excluded.source_version
        """, (code, date, value, source_version))


def update_sync_state(
    code: str,
    last_success_date: Optional[str] = None,
    status: str = "success",
    message: Optional[str] = None
) -> None:
    """更新同步状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sync_state (code, last_success_date, last_sync_at, status, message)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                last_success_date = excluded.last_success_date,
                last_sync_at = excluded.last_sync_at,
                status = excluded.status,
                message = excluded.message
        """, (code, last_success_date, status, message))


def get_sync_state(code: str) -> Optional[Dict]:
    """获取同步状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sync_state WHERE code = ?", (code,))
        row = cursor.fetchone()
        return dict(row) if row else None


def save_user_state(key: str, value: str) -> None:
    """保存用户状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_state (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        """, (key, value))


def load_user_state(key: str) -> Optional[str]:
    """加载用户状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM user_state WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else None


def delete_instrument(code: str) -> Dict:
    """
    删除基金/指数及其所有关联数据

    注意：依赖外键约束 ON DELETE CASCADE 自动删除关联数据

    Args:
        code: 基金/指数代码

    Returns:
        删除结果统计
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 删除主表记录，外键约束会自动级联删除关联数据
        cursor.execute("DELETE FROM instrument WHERE code = ?", (code,))
        instrument_deleted = cursor.rowcount

        return {
            "code": code,
            "instrument_deleted": instrument_deleted,
            "message": "关联数据通过外键约束自动删除"
        }


def save_surge_event(
    code: str,
    start_date: str,
    end_date: str,
    window: int,
    total_gain: float,
    slope_first: float = 0,
    slope_second: float = 0,
    is_accelerating: bool = False
) -> None:
    """保存急涨事件"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO surge_events 
            (code, start_date, end_date, window, total_gain, slope_first, slope_second, is_accelerating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (code, start_date, end_date, window, total_gain, slope_first, slope_second, 1 if is_accelerating else 0))


def get_surge_events(code: str) -> List[Dict]:
    """获取某只基金的急涨事件"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM surge_events WHERE code = ? ORDER BY start_date DESC
        """, (code,))
        return [dict(row) for row in cursor.fetchall()]


def clear_surge_events() -> None:
    """清空所有急涨事件"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM surge_events")


if __name__ == "__main__":
    # 初始化数据库
    init_database()
    print("Database tables created successfully.")
