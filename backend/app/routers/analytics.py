from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, cast, Date, text
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AnalyticsLog

router = APIRouter(prefix="/analytics", tags=["analytics"])


class DailyStats(BaseModel):
    date: str
    request_type: str
    request_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int


class DailyStatsResponse(BaseModel):
    stats: List[DailyStats]


@router.get("/daily", response_model=DailyStatsResponse)
async def get_daily_stats(
    timezone: Optional[str] = Query(
        None,
        description="Timezone name (e.g., 'America/New_York', 'Europe/London', 'UTC'). If not provided, uses UTC.",
    ),
    db: Session = Depends(get_db),
):
    """
    Get daily aggregated analytics stats.
    Returns request counts and token usage grouped by date and request type.

    Times are converted to the specified timezone before grouping by date.
    If no timezone is provided, UTC is used.
    """
    if timezone:
        timezone_expr = text("timezone(:tz, analytics_logs.created_at)").bindparams(
            tz=timezone
        )
    else:
        # No timezone conversion, use UTC as-is
        timezone_expr = AnalyticsLog.created_at
    results = (
        db.query(
            cast(timezone_expr, Date).label("date"),
            AnalyticsLog.request_type,
            func.count(AnalyticsLog.id).label("request_count"),
            func.sum(AnalyticsLog.input_tokens).label("input_tokens"),
            func.sum(AnalyticsLog.output_tokens).label("output_tokens"),
            func.sum(AnalyticsLog.total_tokens).label("total_tokens"),
        )
        .group_by(cast(timezone_expr, Date), AnalyticsLog.request_type)
        .order_by(cast(timezone_expr, Date).desc())
        .all()
    )
    stats = [
        DailyStats(
            date=str(row.date),
            request_type=row.request_type,
            request_count=row.request_count,
            input_tokens=row.input_tokens or 0,
            output_tokens=row.output_tokens or 0,
            total_tokens=row.total_tokens or 0,
        )
        for row in results
    ]
    return DailyStatsResponse(stats=stats)
