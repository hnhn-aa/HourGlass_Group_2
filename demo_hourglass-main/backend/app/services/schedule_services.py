from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.profile import StudentProfile
from app.models.schedule import Availability, Schedule
from app.schemas.schedules import AvailabilityCreateSchema, ScheduleCreateSchema


def _ensure_student_exists(db: Session, student_id: int) -> StudentProfile:
    student = (
        db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hồ sơ sinh viên (student_profiles.id = {student_id})",
        )
    return student


def get_availabilities(
    db: Session, student_id: int | None = None
) -> list[Availability]:
    q = db.query(Availability)
    if student_id is not None:
        q = q.filter(Availability.student_id == student_id)
    return q.order_by(
        Availability.day_of_week.asc(), Availability.start_time.asc()
    ).all()


def create_availability(
    db: Session, data: AvailabilityCreateSchema
) -> Availability:
    _ensure_student_exists(db, data.student_id)
    now = datetime.now()
    avail = Availability(
        student_id=data.student_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        is_available=data.is_available,
        created_at=now,
        updated_at=now,
    )
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail


def delete_availability(db: Session, availability_id: int) -> None:
    avail = (
        db.query(Availability)
        .filter(Availability.id == availability_id)
        .first()
    )
    if not avail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy khung giờ rảnh (availabilities.id = {availability_id})",
        )
    db.delete(avail)
    db.commit()


def get_schedules(
    db: Session, student_id: int | None = None
) -> list[Schedule]:
    q = db.query(Schedule)
    if student_id is not None:
        q = q.filter(Schedule.student_id == student_id)
    return q.order_by(Schedule.start_datetime.asc()).all()


def create_schedule(db: Session, data: ScheduleCreateSchema) -> Schedule:
    _ensure_student_exists(db, data.student_id)
    if data.job_id is not None:
        job = db.query(Job).filter(Job.id == data.job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy tin tuyển dụng (jobs.id = {data.job_id})",
            )
    now = datetime.now()
    sched = Schedule(
        student_id=data.student_id,
        job_id=data.job_id,
        title=data.title,
        start_datetime=data.start_datetime,
        end_datetime=data.end_datetime,
        note=data.note,
        created_at=now,
        updated_at=now,
    )
    db.add(sched)
    db.commit()
    db.refresh(sched)
    return sched


def delete_schedule(db: Session, schedule_id: int) -> None:
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy lịch làm việc/học tập (schedules.id = {schedule_id})",
        )
    db.delete(sched)
    db.commit()
