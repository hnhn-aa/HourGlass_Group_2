from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.dependencies.middleware import verify_student_or_internal
from app.schemas.schedules import (
    AvailabilityCreateSchema,
    AvailabilityOutSchema,
    ScheduleCreateSchema,
    ScheduleOutSchema,
)
from app.services.schedule_services import (
    create_availability,
    create_schedule,
    delete_availability,
    delete_schedule,
    get_availabilities,
    get_schedules,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/api/availabilities",
    tags=["Schedules & Availabilities"],
    summary="Danh sách thời gian rảnh của sinh viên (availabilities)",
)
def list_availabilities(
    db: DbSession,
    student_id: int | None = Query(default=None, gt=0),
):
    items = get_availabilities(db, student_id=student_id)
    return {
        "success": True,
        "total": len(items),
        "availabilities": [
            AvailabilityOutSchema.model_validate(a) for a in items
        ],
    }


@router.post(
    "/api/availabilities",
    status_code=status.HTTP_201_CREATED,
    tags=["Schedules & Availabilities"],
    summary="Thêm khung giờ rảnh của sinh viên",
    dependencies=[Depends(verify_student_or_internal)],
)
def add_availability(data: AvailabilityCreateSchema, db: DbSession):
    avail = create_availability(db, data)
    return {
        "success": True,
        "availability": AvailabilityOutSchema.model_validate(avail),
    }


@router.delete(
    "/api/availabilities/{availability_id}",
    tags=["Schedules & Availabilities"],
    summary="Xóa khung giờ rảnh",
    dependencies=[Depends(verify_student_or_internal)],
)
def remove_availability(availability_id: int, db: DbSession):
    delete_availability(db, availability_id)
    return {"success": True, "message": "Đã xóa khung giờ rảnh thành công"}


@router.get(
    "/api/schedules",
    tags=["Schedules & Availabilities"],
    summary="Danh sách lịch làm việc / học tập của sinh viên (schedules)",
)
def list_schedules(
    db: DbSession,
    student_id: int | None = Query(default=None, gt=0),
):
    items = get_schedules(db, student_id=student_id)
    return {
        "success": True,
        "total": len(items),
        "schedules": [ScheduleOutSchema.model_validate(s) for s in items],
    }


@router.post(
    "/api/schedules",
    status_code=status.HTTP_201_CREATED,
    tags=["Schedules & Availabilities"],
    summary="Tạo lịch làm việc / học tập mới",
    dependencies=[Depends(verify_student_or_internal)],
)
def add_schedule(data: ScheduleCreateSchema, db: DbSession):
    sched = create_schedule(db, data)
    return {
        "success": True,
        "schedule": ScheduleOutSchema.model_validate(sched),
    }


@router.delete(
    "/api/schedules/{schedule_id}",
    tags=["Schedules & Availabilities"],
    summary="Xóa lịch làm việc / học tập",
    dependencies=[Depends(verify_student_or_internal)],
)
def remove_schedule(schedule_id: int, db: DbSession):
    delete_schedule(db, schedule_id)
    return {"success": True, "message": "Đã xóa lịch thành công"}
