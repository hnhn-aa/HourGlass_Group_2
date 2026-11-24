"""Dọn dữ liệu test rác trong database HourGlass trước buổi demo.

Cách dùng (chạy trong thư mục backend/):
    python scripts/clean_demo_data.py                     # XEM TRƯỚC: chỉ liệt kê, không xóa gì
    python scripts/clean_demo_data.py --apply             # xóa dữ liệu test (tự sao lưu DB trước)
    python scripts/clean_demo_data.py --all-non-seed      # xem trước: thêm mọi dữ liệu phát sinh sau bộ seed
    python scripts/clean_demo_data.py --all-non-seed --apply
    python scripts/clean_demo_data.py --db path/to/other.db

Quy tắc nhận diện:
  1. Mặc định – bản ghi có dấu hiệu test: chứa "E2E"/"e2e", "thử nghiệm", "test", "lorem",
     hoặc giá trị mặc định "string" của Swagger; email test (@example.com, e2e…, test…).
  2. --all-non-seed – thêm mọi bản ghi tạo SAU bộ dữ liệu mẫu của seed_data.py
     (mốc SEED_CUTOFF), để database trở về đúng bộ demo chuẩn.
  Kèm theo: xóa dây chuyền mọi dữ liệu phụ thuộc (hồ sơ ứng tuyển, lịch sử trạng thái, CV,
  việc đã lưu, lịch làm, đánh giá, báo cáo…), xóa file upload không còn được tham chiếu,
  rồi VACUUM để dữ liệu đã xóa không còn nằm trong file .db.

Hỗ trợ SQLite (mặc định của dự án). Với MySQL, script dùng SQLAlchemy theo DATABASE_URL trong .env.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"
BACKUP_DIR = BACKEND_DIR / "backups"

# Dữ liệu mẫu trong seed_data.py có mốc thời gian muộn nhất là 2026-11-10 11:00
SEED_CUTOFF = "2026-11-10 23:59:59"

JUNK_TEXT = re.compile(r"e2e|thử nghiệm|thu nghiem|\btest(ing)?\b|\blorem\b|\bdummy\b", re.IGNORECASE)
JUNK_EMAIL = re.compile(r"e2e|^test|test\d|@example\.(com|org)$|@test\.", re.IGNORECASE)
SWAGGER_PLACEHOLDER = {"string"}
PROTECTED_FILES = {"sample_cv_tai.pdf", "sample_cv_lananh.pdf", "sample_cv_manh.pdf"}


# ─────────────────────────── Kết nối DB ───────────────────────────
class DB:
    def __init__(self, url: str):
        self.url = url
        self.sqlite_path: Path | None = None
        if url.startswith("sqlite:///"):
            raw = url[len("sqlite:///"):]
            p = Path(raw)
            self.sqlite_path = p if p.is_absolute() else (BACKEND_DIR / raw).resolve()
            if not self.sqlite_path.exists():
                sys.exit(f"Không tìm thấy file database: {self.sqlite_path}")
            self.conn = sqlite3.connect(self.sqlite_path)
            self.conn.row_factory = sqlite3.Row
            self.engine = None
        else:
            try:
                from sqlalchemy import create_engine
            except ImportError:
                sys.exit("Cần cài SQLAlchemy để dọn database không phải SQLite (pip install -r requirements.txt).")
            self.engine = create_engine(url)
            self.conn = self.engine.connect()

    def rows(self, sql: str) -> list[dict]:
        if self.engine is None:
            return [dict(r) for r in self.conn.execute(sql).fetchall()]
        from sqlalchemy import text
        return [dict(r) for r in self.conn.execute(text(sql)).mappings().all()]

    def run(self, sql: str) -> int:
        if self.engine is None:
            return self.conn.execute(sql).rowcount
        from sqlalchemy import text
        return self.conn.execute(text(sql)).rowcount

    def tables(self) -> set[str]:
        if self.engine is None:
            return {r["name"] for r in self.rows("SELECT name FROM sqlite_master WHERE type='table'")}
        from sqlalchemy import inspect
        return set(inspect(self.engine).get_table_names())

    def commit(self):
        self.conn.commit()

    def vacuum(self):
        if self.engine is None:
            self.conn.execute("VACUUM")


def database_url(cli_db: str | None) -> str:
    if cli_db:
        return cli_db if "://" in cli_db else f"sqlite:///{Path(cli_db).resolve()}"
    try:
        from dotenv import load_dotenv
        load_dotenv(BACKEND_DIR / ".env")
    except ImportError:
        pass
    return os.environ.get("DATABASE_URL") or "sqlite:///./hourglass.db"


# ─────────────────────────── Nhận diện dữ liệu rác ───────────────────────────
def junk_text(*values) -> bool:
    return any(isinstance(v, str) and (JUNK_TEXT.search(v) or v.strip().lower() in SWAGGER_PLACEHOLDER) for v in values)


def after_cutoff(value) -> bool:
    return value is not None and str(value)[:19] > SEED_CUTOFF


def ids(rows) -> set[int]:
    return {int(r["id"]) for r in rows}


def in_list(values) -> str:
    return "(" + ",".join(str(int(v)) for v in sorted(values)) + ")" if values else "(NULL)"


def collect(db: DB, all_non_seed: bool) -> dict[str, set[int]]:
    t = db.tables()
    users = db.rows("SELECT id, email, full_name, created_at FROM users")
    jobs = db.rows("SELECT id, employer_id, recruiter_id, title, description, requirements, created_at FROM jobs")
    apps = db.rows("SELECT id, student_id, job_id, cv_id, cover_letter, applied_at FROM applications")
    cvs = db.rows("SELECT id, student_id, file_name, uploaded_at FROM cvs")

    bad_users = {u["id"] for u in users if JUNK_EMAIL.search(u["email"] or "") or junk_text(u["full_name"])
                 or (all_non_seed and after_cutoff(u["created_at"]))}
    sp = db.rows("SELECT id, user_id FROM student_profiles")
    ep = db.rows("SELECT id, user_id FROM employer_profiles")
    bad_students = {r["id"] for r in sp if r["user_id"] in bad_users}
    bad_employers = {r["id"] for r in ep if r["user_id"] in bad_users}

    bad_jobs = {j["id"] for j in jobs if junk_text(j["title"], j["description"], j["requirements"])
                or j["employer_id"] in bad_users or j["recruiter_id"] in bad_employers
                or (all_non_seed and after_cutoff(j["created_at"]))}
    bad_cvs = {c["id"] for c in cvs if junk_text(c["file_name"]) or c["student_id"] in bad_students
               or (all_non_seed and after_cutoff(c["uploaded_at"]))}
    bad_apps = {a["id"] for a in apps if a["job_id"] in bad_jobs or a["student_id"] in bad_students
                or a["cv_id"] in bad_cvs or junk_text(a["cover_letter"])
                or (all_non_seed and after_cutoff(a["applied_at"]))}
    # CV chỉ được dùng cho các hồ sơ ứng tuyển rác và tải lên sau bộ seed → cũng là rác
    used_by_good = {a["cv_id"] for a in apps if a["id"] not in bad_apps}
    used_by_bad = {a["cv_id"] for a in apps if a["id"] in bad_apps}
    bad_cvs |= {c["id"] for c in cvs if c["id"] in used_by_bad and c["id"] not in used_by_good and after_cutoff(c["uploaded_at"])}

    out = {
        "users": bad_users,
        "student_profiles": bad_students,
        "employer_profiles": bad_employers,
        "jobs": bad_jobs,
        "cvs": bad_cvs,
        "applications": bad_apps,
    }
    out["application_status_logs"] = ids(db.rows(
        f"SELECT id FROM application_status_logs WHERE application_id IN {in_list(bad_apps)}"
        + (f" OR changed_at > '{SEED_CUTOFF}'" if all_non_seed else "")))
    if "admin_profiles" in t:
        out["admin_profiles"] = ids(db.rows(f"SELECT id FROM admin_profiles WHERE user_id IN {in_list(bad_users)}"))
    if "job_saves" in t:
        out["job_saves"] = ids(db.rows(
            f"SELECT id FROM job_saves WHERE job_id IN {in_list(bad_jobs)} OR student_id IN {in_list(bad_students)}"
            + (f" OR created_at > '{SEED_CUTOFF}'" if all_non_seed else "")))
    if "schedules" in t:
        sch = db.rows("SELECT id, student_id, job_id, title, note, created_at FROM schedules")
        out["schedules"] = {s["id"] for s in sch if s["job_id"] in bad_jobs or s["student_id"] in bad_students
                            or junk_text(s["title"], s["note"]) or (all_non_seed and after_cutoff(s["created_at"]))}
    if "availabilities" in t:
        out["availabilities"] = ids(db.rows(f"SELECT id FROM availabilities WHERE student_id IN {in_list(bad_students)}"))
    if "reviews" in t:
        rv = db.rows("SELECT id, reviewer_id, target_id, job_id, comment, created_at FROM reviews")
        out["reviews"] = {r["id"] for r in rv if r["reviewer_id"] in bad_users or r["target_id"] in bad_users
                          or r["job_id"] in bad_jobs or junk_text(r["comment"])
                          or (all_non_seed and after_cutoff(r["created_at"]))}
    if "reports" in t:
        rp = db.rows("SELECT id, reporter_id, report_type, target_id, reason, created_at FROM reports")
        target_sets = {"job": bad_jobs, "employer": bad_employers, "user": bad_users, "application": bad_apps}
        out["reports"] = {r["id"] for r in rp if r["reporter_id"] in bad_users or junk_text(r["reason"])
                          or r["target_id"] in target_sets.get(str(r["report_type"]).lower(), set())
                          or (all_non_seed and after_cutoff(r["created_at"]))}
    if "password_resets" in t:
        out["password_resets"] = ids(db.rows(f"SELECT id FROM password_resets WHERE user_id IN {in_list(bad_users)}"))
    return out


# Thứ tự xóa: bảng con trước, bảng cha sau (SQLite của dự án không bật ràng buộc khóa ngoại)
DELETE_ORDER = [
    "application_status_logs", "applications", "job_saves", "schedules", "reviews", "reports",
    "cvs", "jobs", "availabilities", "password_resets",
    "student_profiles", "employer_profiles", "admin_profiles", "users",
]
PREVIEW_SQL = {
    "users": "SELECT id, email AS info FROM users",
    "jobs": "SELECT id, title AS info FROM jobs",
    "applications": "SELECT id, 'SV ' || student_id || ' → tin ' || job_id || ' · ' || COALESCE(cover_letter, '') AS info FROM applications",
    "cvs": "SELECT id, file_name AS info FROM cvs",
}


def referenced_files(db: DB, removed: dict[str, set[int]] | None = None) -> set[str]:
    """File trong uploads/ còn được tham chiếu (bỏ qua các bản ghi sắp bị xóa)."""
    removed = removed or {}
    refs: set[str] = set()
    for table, col in (("cvs", "file_url"), ("jobs", "image_url"), ("employer_profiles", "logo_url"), ("student_profiles", "avatar_url")):
        try:
            for r in db.rows(f"SELECT id, {col} AS u FROM {table}"):
                if r["id"] not in removed.get(table, set()) and r["u"] and "/uploads/" in str(r["u"]):
                    refs.add(str(r["u"]).split("/uploads/", 1)[-1])
        except Exception:
            pass
    return refs


def orphan_files(refs: set[str]) -> list[Path]:
    if not UPLOAD_DIR.exists():
        return []
    files = [p for p in UPLOAD_DIR.rglob("*") if p.is_file() and not p.name.startswith(".")]
    return sorted(p for p in files if p.name not in PROTECTED_FILES and p.relative_to(UPLOAD_DIR).as_posix() not in refs)


def main() -> None:
    ap = argparse.ArgumentParser(description="Dọn dữ liệu test rác trong database HourGlass trước demo.")
    ap.add_argument("--apply", action="store_true", help="Thực hiện xóa (mặc định chỉ xem trước)")
    ap.add_argument("--all-non-seed", action="store_true", help="Xóa cả mọi dữ liệu phát sinh sau bộ seed_data.py")
    ap.add_argument("--db", help="Đường dẫn file SQLite hoặc DATABASE_URL (mặc định đọc từ backend/.env)")
    ap.add_argument("--keep-files", action="store_true", help="Không xóa file upload không còn được tham chiếu")
    ap.add_argument("--no-backup", action="store_true", help="Không tạo bản sao lưu trước khi xóa")
    args = ap.parse_args()

    url = database_url(args.db)
    db = DB(url)
    global UPLOAD_DIR, BACKUP_DIR
    if db.sqlite_path and db.sqlite_path.parent != BACKEND_DIR:   # --db trỏ tới bản sao ở nơi khác
        UPLOAD_DIR = db.sqlite_path.parent / "uploads"
        BACKUP_DIR = db.sqlite_path.parent / "backups"
    print(f"Database: {db.sqlite_path or url}")
    print("Chế độ  :", "XÓA THẬT" if args.apply else "XEM TRƯỚC (chưa xóa gì)",
          "· gồm mọi dữ liệu sau bộ seed" if args.all_non_seed else "· chỉ dữ liệu có dấu hiệu test")

    found = collect(db, args.all_non_seed)
    total = sum(len(v) for v in found.values())
    for table in DELETE_ORDER:
        rows = found.get(table) or set()
        if not rows:
            continue
        print(f"\n• {table}: {len(rows)} bản ghi {sorted(rows)}")
        if table in PREVIEW_SQL:
            for r in db.rows(PREVIEW_SQL[table] + f" WHERE id IN {in_list(rows)}"):
                print(f"    #{r['id']}: {str(r['info'])[:90]}")

    if not total:
        print("\n✓ Không phát hiện dữ liệu test rác.")
    files = [] if args.keep_files else orphan_files(referenced_files(db, found))
    if files:
        print(f"\n• File upload không còn được dùng: {len(files)}")
        for p in files:
            print(f"    {p.relative_to(UPLOAD_DIR.parent)}")

    if not args.apply:
        if total or files:
            print("\n→ Chạy lại với --apply để xóa.")
        return

    if total and db.sqlite_path and not args.no_backup:
        BACKUP_DIR.mkdir(exist_ok=True)
        backup = BACKUP_DIR / f"{db.sqlite_path.stem}-{datetime.now():%Y%m%d-%H%M%S}.db"
        db.conn.commit()
        shutil.copy2(db.sqlite_path, backup)
        print(f"\nĐã sao lưu: {backup.relative_to(UPLOAD_DIR.parent)} (xóa file này sau khi kiểm tra xong)")

    deleted = 0
    try:
        for table in DELETE_ORDER:
            rows = found.get(table) or set()
            if rows:
                deleted += db.run(f"DELETE FROM {table} WHERE id IN {in_list(rows)}")
        db.commit()
    except Exception as exc:
        db.conn.rollback()
        sys.exit(f"Lỗi khi xóa, đã hoàn tác: {exc}")
    print(f"\n✓ Đã xóa {deleted} bản ghi.")

    if not args.keep_files:
        for p in orphan_files(referenced_files(db)):
            p.unlink()
            print(f"  đã xóa file {p.relative_to(UPLOAD_DIR.parent)}")
    db.vacuum()
    print("✓ Hoàn tất. Khởi động lại backend và tải lại trang (Ctrl+F5) để thấy dữ liệu mới.")


if __name__ == "__main__":
    main()
