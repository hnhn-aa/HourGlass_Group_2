from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.profile import StudentProfile
from app.models.schedule import Availability, Schedule
from app.models.user import RoleEnum, User
from app.schemas.schedules import (
    AvailabilityCreateSchema,
    ScheduleCreateSchema,
    ScheduleUpdateSchema,
)


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


# ── Quyền sở hữu: sinh viên đăng nhập chỉ thao tác trên lịch của CHÍNH MÌNH ──
# (Admin hoặc lời gọi nội bộ không kèm JWT vẫn được phép – giữ tương thích với Frontend hiện tại)
def ensure_schedule_owner(db: Session, current_user: User | None, student_id: int) -> None:
    if current_user is None or current_user.role != RoleEnum.STUDENT:
        return
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == current_user.id)
        .first()
    )
    if not profile or profile.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn chỉ được thao tác trên lịch làm việc của chính mình",
        )


def _ensure_job_exists(db: Session, job_id: int | None) -> None:
    if job_id is None:
        return
    if not db.query(Job).filter(Job.id == job_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tin tuyển dụng (jobs.id = {job_id})",
        )


def find_overlapping_schedule(
    db: Session,
    student_id: int,
    start: datetime,
    end: datetime,
    exclude_id: int | None = None,
) -> Schedule | None:
    """Ca bị trùng: khoảng [start, end) giao nhau với ca khác của cùng sinh viên.
    Hai ca nối tiếp nhau (ca trước kết thúc đúng lúc ca sau bắt đầu) KHÔNG tính là trùng."""
    q = db.query(Schedule).filter(
        Schedule.student_id == student_id,
        Schedule.start_datetime < end,
        Schedule.end_datetime > start,
    )
    if exclude_id is not None:
        q = q.filter(Schedule.id != exclude_id)
    return q.order_by(Schedule.start_datetime.asc()).first()


def _raise_overlap(other: Schedule) -> None:
    same_day = other.start_datetime.date() == other.end_datetime.date()
    end_fmt = "%H:%M" if same_day else "%H:%M %d/%m/%Y"
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            f'Trùng lịch với ca "{other.title}" '
            f"({other.start_datetime:%H:%M %d/%m/%Y} – {other.end_datetime.strftime(end_fmt)}). "
            "Vui lòng chọn khung giờ khác."
        ),
    )


def create_schedule(
    db: Session, data: ScheduleCreateSchema, current_user: User | None = None
) -> Schedule:
    _ensure_student_exists(db, data.student_id)
    ensure_schedule_owner(db, current_user, data.student_id)
    _ensure_job_exists(db, data.job_id)
    other = find_overlapping_schedule(
        db, data.student_id, data.start_datetime, data.end_datetime
    )
    if other:
        _raise_overlap(other)
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


def _get_schedule_or_404(db: Session, schedule_id: int) -> Schedule:
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy lịch làm việc/học tập (schedules.id = {schedule_id})",
        )
    return sched


def update_schedule(
    db: Session,
    schedule_id: int,
    data: ScheduleUpdateSchema,
    current_user: User | None = None,
) -> Schedule:
    sched = _get_schedule_or_404(db, schedule_id)
    ensure_schedule_owner(db, current_user, sched.student_id)
    fields = data.model_dump(exclude_unset=True)
    start = fields.get("start_datetime") or sched.start_datetime
    end = fields.get("end_datetime") or sched.end_datetime
    if end <= start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Giờ kết thúc phải sau giờ bắt đầu",
        )
    if "job_id" in fields:
        _ensure_job_exists(db, fields["job_id"])
    other = find_overlapping_schedule(
        db, sched.student_id, start, end, exclude_id=sched.id
    )
    if other:
        _raise_overlap(other)
    for key, value in fields.items():
        if key == "title" and value is None:
            continue   # tiêu đề là cột bắt buộc
        setattr(sched, key, value)
    sched.updated_at = datetime.now()
    db.commit()
    db.refresh(sched)
    return sched


def delete_schedule(
    db: Session, schedule_id: int, current_user: User | None = None
) -> None:
    sched = _get_schedule_or_404(db, schedule_id)
    ensure_schedule_owner(db, current_user, sched.student_id)
    db.delete(sched)
    db.commit()
