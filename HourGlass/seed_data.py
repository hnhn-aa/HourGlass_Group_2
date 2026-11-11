from datetime import datetime, date, time
from decimal import Decimal
from apps.db.database import SessionLocal, engine
from apps.core.security import hashed_password
from sqlalchemy import text

# Import đầy đủ các models
from apps.models.user import User, RoleEnum, UserStatusEnum
from apps.models.profile import PasswordReset, StudentProfile, EmployerProfile, AdminProfile
from apps.models.job import JobCategory, JobLocation, Job, JobSave, JobTypeEnum, JobStatusEnum, LocationTypeEnum
from apps.models.application import ApplicationStatusRef, CV, Application, ApplicationStatusLog, AppStatusEnum, FileTypeEnum
from apps.models.schedule import Availability, Schedule
from apps.models.report import Report, ReportTypeEnum, ReportStatusEnum


def seed():
    db = SessionLocal()
    print("Bắt đầu nạp seed data...")

    # Xóa sạch dữ liệu cũ theo đúng thứ tự an toàn
    try:
        with engine.connect() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            tables = [
                "reports", "schedules", "availabilities", "application_status_logs",
                "applications", "cvs", "application_statuses", "job_saves",
                "jobs", "job_locations", "job_categories", "admin_profiles",
                "employer_profiles", "student_profiles", "password_resets", "users"
            ]
            for t in tables:
                conn.execute(text(f"TRUNCATE TABLE {t};"))
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            conn.commit()
        print("-> Đã làm sạch các bảng dữ liệu cũ.")
    except Exception as e:
        print("Lỗi khi truncate:", e)

    # 1. USERS
    raw_users = [
        {"id": 1, "email": "student1@gmail.com", "password": "password123", "full_name": "Nguyễn Văn An", "phone": "0987654321", "role": RoleEnum.STUDENT, "status": UserStatusEnum.ACTIVE, "created_at": datetime.fromisoformat("2026-01-10 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-10 08:00:00")},
        {"id": 2, "email": "student2@gmail.com", "password": "password123", "full_name": "Trần Thị Bình", "phone": "0987654322", "role": RoleEnum.STUDENT, "status": UserStatusEnum.ACTIVE, "created_at": datetime.fromisoformat("2026-01-11 09:00:00"), "updated_at": datetime.fromisoformat("2026-01-11 09:00:00")},
        {"id": 3, "email": "student3@gmail.com", "password": "password123", "full_name": "Lê Minh Đức", "phone": "0987654323", "role": RoleEnum.STUDENT, "status": UserStatusEnum.ACTIVE, "created_at": datetime.fromisoformat("2026-01-12 10:00:00"), "updated_at": datetime.fromisoformat("2026-01-12 10:00:00")},
        {"id": 4, "email": "employer1@gmail.com", "password": "password123", "full_name": "Phạm Quốc Huy", "phone": "0977111222", "role": RoleEnum.EMPLOYER, "status": UserStatusEnum.ACTIVE, "created_at": datetime.fromisoformat("2026-01-15 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-15 08:00:00")},
        {"id": 5, "email": "employer2@gmail.com", "password": "password123", "full_name": "Hoàng Thu Trang", "phone": "0977222333", "role": RoleEnum.EMPLOYER, "status": UserStatusEnum.ACTIVE, "created_at": datetime.fromisoformat("2026-01-16 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-16 08:00:00")},
        {"id": 6, "email": "admin@gmail.com", "password": "password123", "full_name": "Nguyễn Hoàng Nam", "phone": "0966333444", "role": RoleEnum.ADMIN, "status": UserStatusEnum.ACTIVE, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")}
    ]
    for u in raw_users:
        user = User(
            id=u["id"],
            email=u["email"],
            hashed_password=hashed_password(u["password"]),
            full_name=u["full_name"],
            phone=u["phone"],
            role=u["role"],
            status=u["status"],
            created_at=u["created_at"],
            updated_at=u["updated_at"]
        )
        db.add(user)
    db.commit()
    print("-> 1. Users OK")

    # 2. PASSWORD_RESETS
    raw_resets = [
        {"id": 1, "user_id": 1, "token": "reset_token_001", "expires_at": datetime.fromisoformat("2026-11-11 10:00:00"), "created_at": datetime.fromisoformat("2026-11-10 10:00:00")}
    ]
    for r in raw_resets:
        db.add(PasswordReset(**r))
    db.commit()
    print("-> 2. Password Resets OK")

    # 3. STUDENT_PROFILES
    raw_student_profiles = [
        {"id": 1, "user_id": 1, "university": "Đại học Công nghệ", "major": "Công nghệ thông tin", "bio": "Sinh viên năm 2, yêu thích lập trình.", "address": "Bắc Từ Liêm, Hà Nội", "date_of_birth": date.fromisoformat("2006-05-15"), "avatar_url": "https://i.pravatar.cc/150?img=12", "created_at": datetime.fromisoformat("2026-01-10 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-10 08:00:00")},
        {"id": 2, "user_id": 2, "university": "Đại học Kinh tế Quốc dân", "major": "Quản trị kinh doanh", "bio": "Năng động, có khả năng giao tiếp tốt.", "address": "Hai Bà Trưng, Hà Nội", "date_of_birth": date.fromisoformat("2005-08-20"), "avatar_url": "https://i.pravatar.cc/150?img=47", "created_at": datetime.fromisoformat("2026-01-11 09:00:00"), "updated_at": datetime.fromisoformat("2026-01-11 09:00:00")},
        {"id": 3, "user_id": 3, "university": "Học viện Công nghệ Bưu chính Viễn thông", "major": "Marketing", "bio": "Quan tâm đến truyền thông và kinh doanh.", "address": "Cầu Giấy, Hà Nội", "date_of_birth": date.fromisoformat("2005-12-10"), "avatar_url": "https://i.pravatar.cc/150?img=15", "created_at": datetime.fromisoformat("2026-01-12 10:00:00"), "updated_at": datetime.fromisoformat("2026-01-12 10:00:00")}
    ]
    for sp in raw_student_profiles:
        db.add(StudentProfile(**sp))
    db.commit()
    print("-> 3. Student Profiles OK")

    # 4. EMPLOYER_PROFILES
    raw_employer_profiles = [
        {"id": 1, "user_id": 4, "company_name": "Highlands Coffee", "representative_name": "Phạm Quốc Huy", "company_address": "Cầu Giấy, Hà Nội", "company_phone": "02435556666", "industry": "Dịch vụ ăn uống", "description": "Hệ thống cửa hàng cà phê và đồ uống.", "logo_url": "https://placehold.co/150x150?text=Highlands", "verified": True, "created_at": datetime.fromisoformat("2026-01-15 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-15 08:00:00")},
        {"id": 2, "user_id": 5, "company_name": "FPT Shop", "representative_name": "Hoàng Thu Trang", "company_address": "Đống Đa, Hà Nội", "company_phone": "02436667777", "industry": "Bán lẻ", "description": "Hệ thống bán lẻ sản phẩm công nghệ.", "logo_url": "https://placehold.co/150x150?text=FPT+Shop", "verified": True, "created_at": datetime.fromisoformat("2026-01-16 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-16 08:00:00")}
    ]
    for ep in raw_employer_profiles:
        db.add(EmployerProfile(**ep))
    db.commit()
    print("-> 4. Employer Profiles OK")

    # 5. ADMIN_PROFILES
    raw_admin_profiles = [
        {"id": 1, "user_id": 6, "position": "Quản trị viên hệ thống", "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")}
    ]
    for ap in raw_admin_profiles:
        db.add(AdminProfile(**ap))
    db.commit()
    print("-> 5. Admin Profiles OK")

    # 6. JOB_CATEGORIES
    raw_categories = [
        {"id": 1, "name": "Phục vụ", "description": "Công việc phục vụ tại nhà hàng, quán cà phê.", "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 2, "name": "Bán hàng", "description": "Công việc tư vấn và bán sản phẩm.", "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 3, "name": "Marketing", "description": "Công việc truyền thông và tiếp thị.", "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 4, "name": "Công nghệ thông tin", "description": "Công việc liên quan đến lập trình và công nghệ.", "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")}
    ]
    for c in raw_categories:
        db.add(JobCategory(**c))
    db.commit()
    print("-> 6. Job Categories OK")

    # 7. JOB_LOCATIONS
    raw_locations = [
        {"id": 1, "name": "Hà Nội", "type": LocationTypeEnum.CITY, "parent_id": None, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 2, "name": "Cầu Giấy", "type": LocationTypeEnum.DISTRICT, "parent_id": 1, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 3, "name": "Bắc Từ Liêm", "type": LocationTypeEnum.DISTRICT, "parent_id": 1, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 4, "name": "Đống Đa", "type": LocationTypeEnum.DISTRICT, "parent_id": 1, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 5, "name": "Dịch Vọng", "type": LocationTypeEnum.WARD, "parent_id": 2, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 6, "name": "Phú Diễn", "type": LocationTypeEnum.WARD, "parent_id": 3, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")}
    ]
    for loc in raw_locations:
        db.add(JobLocation(**loc))
    db.commit()
    print("-> 7. Job Locations OK")

    # 8. JOBS
    raw_jobs = [
        {
            "id": 1, "employer_id": 4, "category_id": 1, "location_id": 5, "approved_by": 6,
            "title": "Nhân viên phục vụ part-time", "description": "Phục vụ khách hàng, nhận order và dọn dẹp khu vực làm việc.",
            "requirements": "Từ 18 tuổi, chăm chỉ, giao tiếp tốt.", "salary_min": Decimal("25000"), "salary_max": Decimal("30000"),
            "job_type": JobTypeEnum.PART_TIME, "work_time": "Ca sáng hoặc ca tối", "quantity": 5,
            "experience_level": "Không yêu cầu", "benefits": "Được đào tạo, hỗ trợ ăn ca.",
            "start_date": date.fromisoformat("2026-11-15"), "end_date": date.fromisoformat("2027-05-15"),
            "status": JobStatusEnum.APPROVED, "approved_at": datetime.fromisoformat("2026-11-01 09:00:00"),
            "rejected_reason": None, "created_at": datetime.fromisoformat("2026-10-30 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-01 09:00:00")
        },
        {
            "id": 2, "employer_id": 4, "category_id": 1, "location_id": 2, "approved_by": 6,
            "title": "Nhân viên pha chế", "description": "Chuẩn bị đồ uống theo công thức của cửa hàng.",
            "requirements": "Có trách nhiệm, nhanh nhẹn, ưu tiên biết pha chế.", "salary_min": Decimal("28000"), "salary_max": Decimal("35000"),
            "job_type": JobTypeEnum.PART_TIME, "work_time": "17:00 - 22:00", "quantity": 3,
            "experience_level": "Không yêu cầu", "benefits": "Được hướng dẫn nghiệp vụ.",
            "start_date": date.fromisoformat("2026-11-20"), "end_date": date.fromisoformat("2027-05-20"),
            "status": JobStatusEnum.APPROVED, "approved_at": datetime.fromisoformat("2026-11-02 10:00:00"),
            "rejected_reason": None, "created_at": datetime.fromisoformat("2026-11-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-02 10:00:00")
        },
        {
            "id": 3, "employer_id": 5, "category_id": 2, "location_id": 4, "approved_by": 6,
            "title": "Nhân viên bán hàng", "description": "Tư vấn và hỗ trợ khách hàng lựa chọn sản phẩm công nghệ.",
            "requirements": "Giao tiếp tốt, yêu thích công nghệ.", "salary_min": Decimal("25000"), "salary_max": Decimal("32000"),
            "job_type": JobTypeEnum.PART_TIME, "work_time": "Ca linh hoạt", "quantity": 4,
            "experience_level": "Không yêu cầu", "benefits": "Thưởng theo doanh số.",
            "start_date": date.fromisoformat("2026-11-18"), "end_date": date.fromisoformat("2027-04-18"),
            "status": JobStatusEnum.APPROVED, "approved_at": datetime.fromisoformat("2026-11-03 10:00:00"),
            "rejected_reason": None, "created_at": datetime.fromisoformat("2026-11-02 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-03 10:00:00")
        },
        {
            "id": 4, "employer_id": 5, "category_id": 3, "location_id": 3, "approved_by": None,
            "title": "Cộng tác viên Marketing", "description": "Hỗ trợ đăng bài và quản lý nội dung trên mạng xã hội.",
            "requirements": "Biết sử dụng mạng xã hội, có khả năng viết nội dung.", "salary_min": Decimal("30000"), "salary_max": Decimal("40000"),
            "job_type": JobTypeEnum.PART_TIME, "work_time": "Linh hoạt", "quantity": 2,
            "experience_level": "Ưu tiên có kinh nghiệm", "benefits": "Có cơ hội học hỏi và phát triển kỹ năng.",
            "start_date": date.fromisoformat("2026-12-01"), "end_date": date.fromisoformat("2027-06-01"),
            "status": JobStatusEnum.PENDING, "approved_at": None,
            "rejected_reason": None, "created_at": datetime.fromisoformat("2026-11-09 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-09 08:00:00")
        },
        {
            "id": 5, "employer_id": 5, "category_id": 4, "location_id": 2, "approved_by": None,
            "title": "Thực tập sinh lập trình", "description": "Hỗ trợ phát triển và kiểm thử ứng dụng web.",
            "requirements": "Có kiến thức cơ bản về HTML, CSS, JavaScript.", "salary_min": Decimal("3000000"), "salary_max": Decimal("5000000"),
            "job_type": JobTypeEnum.INTERNSHIP, "work_time": "Thứ 2 đến thứ 6", "quantity": 2,
            "experience_level": "Sinh viên", "benefits": "Được hướng dẫn bởi lập trình viên.",
            "start_date": date.fromisoformat("2026-12-10"), "end_date": date.fromisoformat("2027-06-10"),
            "status": JobStatusEnum.REJECTED, "approved_at": None,
            "rejected_reason": "Thông tin tuyển dụng chưa đầy đủ.", "created_at": datetime.fromisoformat("2026-11-05 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-06 10:00:00")
        }
    ]
    for j in raw_jobs:
        db.add(Job(**j))
    db.commit()
    print("-> 8. Jobs OK")

    # 9. JOB_SAVES
    raw_job_saves = [
        {"id": 1, "student_id": 1, "job_id": 1, "created_at": datetime.fromisoformat("2026-11-05 09:00:00")},
        {"id": 2, "student_id": 1, "job_id": 3, "created_at": datetime.fromisoformat("2026-11-06 10:00:00")},
        {"id": 3, "student_id": 2, "job_id": 2, "created_at": datetime.fromisoformat("2026-11-07 11:00:00")},
        {"id": 4, "student_id": 3, "job_id": 4, "created_at": datetime.fromisoformat("2026-11-09 12:00:00")}
    ]
    for js in raw_job_saves:
        db.add(JobSave(**js))
    db.commit()
    print("-> 9. Job Saves OK")

    # 10. APPLICATION_STATUSES
    raw_app_statuses = [
        {"id": 1, "name": "submitted", "description": "Sinh viên đã gửi hồ sơ ứng tuyển.", "display_order": 1, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 2, "name": "reviewing", "description": "Nhà tuyển dụng đang xem xét hồ sơ.", "display_order": 2, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 3, "name": "interview", "description": "Sinh viên được mời phỏng vấn.", "display_order": 3, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 4, "name": "accepted", "description": "Hồ sơ ứng tuyển được chấp nhận.", "display_order": 4, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 5, "name": "rejected", "description": "Hồ sơ ứng tuyển bị từ chối.", "display_order": 5, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")},
        {"id": 6, "name": "withdrawn", "description": "Sinh viên đã rút hồ sơ ứng tuyển.", "display_order": 6, "created_at": datetime.fromisoformat("2026-01-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-01-01 08:00:00")}
    ]
    for ast in raw_app_statuses:
        db.add(ApplicationStatusRef(**ast))
    db.commit()
    print("-> 10. Application Statuses OK")

    # 11. CVS
    raw_cvs = [
        {"id": 1, "student_id": 1, "file_name": "CV_NguyenVanAn.pdf", "file_url": "/mock-files/CV_NguyenVanAn.pdf", "file_type": FileTypeEnum.PDF, "is_default": True, "uploaded_at": datetime.fromisoformat("2026-10-20 08:00:00")},
        {"id": 2, "student_id": 2, "file_name": "CV_TranThiBinh.docx", "file_url": "/mock-files/CV_TranThiBinh.docx", "file_type": FileTypeEnum.DOCX, "is_default": True, "uploaded_at": datetime.fromisoformat("2026-10-22 09:00:00")},
        {"id": 3, "student_id": 3, "file_name": "CV_LeMinhDuc.pdf", "file_url": "/mock-files/CV_LeMinhDuc.pdf", "file_type": FileTypeEnum.PDF, "is_default": True, "uploaded_at": datetime.fromisoformat("2026-10-25 10:00:00")}
    ]
    for c in raw_cvs:
        db.add(CV(**c))
    db.commit()
    print("-> 11. CVs OK")

    # 12. APPLICATIONS
    raw_applications = [
        {"id": 1, "student_id": 1, "job_id": 1, "cv_id": 1, "status": AppStatusEnum.INTERVIEW, "cover_letter": "Tôi mong muốn được làm việc và học hỏi tại cửa hàng.", "applied_at": datetime.fromisoformat("2026-11-05 09:00:00"), "reviewed_at": datetime.fromisoformat("2026-11-06 10:00:00"), "created_at": datetime.fromisoformat("2026-11-05 09:00:00"), "updated_at": datetime.fromisoformat("2026-11-06 10:00:00")},
        {"id": 2, "student_id": 2, "job_id": 2, "cv_id": 2, "status": AppStatusEnum.REVIEWING, "cover_letter": "Tôi có thể làm việc vào buổi tối và cuối tuần.", "applied_at": datetime.fromisoformat("2026-11-06 10:00:00"), "reviewed_at": datetime.fromisoformat("2026-11-07 09:00:00"), "created_at": datetime.fromisoformat("2026-11-06 10:00:00"), "updated_at": datetime.fromisoformat("2026-11-07 09:00:00")},
        {"id": 3, "student_id": 3, "job_id": 3, "cv_id": 3, "status": AppStatusEnum.SUBMITTED, "cover_letter": "Tôi yêu thích lĩnh vực công nghệ và bán hàng.", "applied_at": datetime.fromisoformat("2026-11-09 08:00:00"), "reviewed_at": None, "created_at": datetime.fromisoformat("2026-11-09 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-09 08:00:00")}
    ]
    for a in raw_applications:
        db.add(Application(**a))
    db.commit()
    print("-> 12. Applications OK")

    # 13. APPLICATION_STATUS_LOGS
    raw_status_logs = [
        {"id": 1, "application_id": 1, "status_id": 1, "note": "Sinh viên gửi hồ sơ ứng tuyển.", "changed_by": 1, "changed_at": datetime.fromisoformat("2026-11-05 09:00:00")},
        {"id": 2, "application_id": 1, "status_id": 2, "note": "Nhà tuyển dụng bắt đầu xem xét.", "changed_by": 4, "changed_at": datetime.fromisoformat("2026-11-05 14:00:00")},
        {"id": 3, "application_id": 1, "status_id": 3, "note": "Mời sinh viên tham gia phỏng vấn.", "changed_by": 4, "changed_at": datetime.fromisoformat("2026-11-06 10:00:00")},
        {"id": 4, "application_id": 2, "status_id": 1, "note": "Sinh viên gửi hồ sơ ứng tuyển.", "changed_by": 2, "changed_at": datetime.fromisoformat("2026-11-06 10:00:00")},
        {"id": 5, "application_id": 2, "status_id": 2, "note": "Đang kiểm tra thông tin ứng viên.", "changed_by": 5, "changed_at": datetime.fromisoformat("2026-11-07 09:00:00")},
        {"id": 6, "application_id": 3, "status_id": 1, "note": "Sinh viên gửi hồ sơ ứng tuyển.", "changed_by": 3, "changed_at": datetime.fromisoformat("2026-11-09 08:00:00")}
    ]
    for l in raw_status_logs:
        db.add(ApplicationStatusLog(**l))
    db.commit()
    print("-> 13. Application Status Logs OK")

    # 14. AVAILABILITIES
    raw_availabilities = [
        {"id": 1, "student_id": 1, "day_of_week": 2, "start_time": time.fromisoformat("17:00:00"), "end_time": time.fromisoformat("22:00:00"), "is_available": True, "created_at": datetime.fromisoformat("2026-11-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-01 08:00:00")},
        {"id": 2, "student_id": 1, "day_of_week": 4, "start_time": time.fromisoformat("17:00:00"), "end_time": time.fromisoformat("22:00:00"), "is_available": True, "created_at": datetime.fromisoformat("2026-11-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-01 08:00:00")},
        {"id": 3, "student_id": 2, "day_of_week": 7, "start_time": time.fromisoformat("08:00:00"), "end_time": time.fromisoformat("17:00:00"), "is_available": True, "created_at": datetime.fromisoformat("2026-11-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-01 08:00:00")},
        {"id": 4, "student_id": 3, "day_of_week": 6, "start_time": time.fromisoformat("08:00:00"), "end_time": time.fromisoformat("12:00:00"), "is_available": True, "created_at": datetime.fromisoformat("2026-11-01 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-01 08:00:00")}
    ]
    for av in raw_availabilities:
        db.add(Availability(**av))
    db.commit()
    print("-> 14. Availabilities OK")

    # 15. SCHEDULES
    raw_schedules = [
        {"id": 1, "student_id": 1, "job_id": 1, "title": "Ca làm việc tại Highlands Coffee", "start_datetime": datetime.fromisoformat("2026-11-15 17:00:00"), "end_datetime": datetime.fromisoformat("2026-11-15 22:00:00"), "note": "Ca làm việc thử.", "created_at": datetime.fromisoformat("2026-11-10 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-10 08:00:00")},
        {"id": 2, "student_id": 2, "job_id": None, "title": "Lịch học trên trường", "start_datetime": datetime.fromisoformat("2026-11-16 07:00:00"), "end_datetime": datetime.fromisoformat("2026-11-16 11:30:00"), "note": "Lịch học buổi sáng.", "created_at": datetime.fromisoformat("2026-11-10 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-10 08:00:00")},
        {"id": 3, "student_id": 3, "job_id": 3, "title": "Ca làm việc tại FPT Shop", "start_datetime": datetime.fromisoformat("2026-11-17 13:00:00"), "end_datetime": datetime.fromisoformat("2026-11-17 18:00:00"), "note": "Ca làm việc buổi chiều.", "created_at": datetime.fromisoformat("2026-11-10 08:00:00"), "updated_at": datetime.fromisoformat("2026-11-10 08:00:00")}
    ]
    for s in raw_schedules:
        db.add(Schedule(**s))
    db.commit()
    print("-> 15. Schedules OK")

    # 16. REPORTS
    raw_reports = [
        {"id": 1, "reporter_id": 1, "report_type": ReportTypeEnum.JOB, "target_id": 5, "reason": "Tin tuyển dụng có thông tin chưa rõ ràng.", "status": ReportStatusEnum.PENDING, "admin_note": None, "created_at": datetime.fromisoformat("2026-11-08 09:00:00"), "updated_at": datetime.fromisoformat("2026-11-08 09:00:00")},
        {"id": 2, "reporter_id": 2, "report_type": ReportTypeEnum.EMPLOYER, "target_id": 2, "reason": "Cần xác minh thêm thông tin doanh nghiệp.", "status": ReportStatusEnum.RESOLVED, "admin_note": "Đã kiểm tra thông tin doanh nghiệp.", "created_at": datetime.fromisoformat("2026-11-09 10:00:00"), "updated_at": datetime.fromisoformat("2026-11-10 08:00:00")}
    ]
    for rep in raw_reports:
        db.add(Report(**rep))
    db.commit()
    print("-> 16. Reports OK")

    db.close()
    print("\n🎉 ĐÃ NẠP TOÀN BỘ 16 BẢNG SEED DATA THÀNH CÔNG!")


if __name__ == "__main__":
    seed()

