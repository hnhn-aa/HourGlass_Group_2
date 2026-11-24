import asyncio
import json
import os
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

# Đảm bảo import được package app từ thư mục gốc backend/
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Sử dụng SQLite tạm thời cho kiểm thử độc lập trước khi import app
_TEST_TMP_DIR = tempfile.TemporaryDirectory()
_TEST_DB_PATH = Path(_TEST_TMP_DIR.name) / "test_hourglass.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"

import app.models  # noqa: E402, F401
from app.db.database import Base, SessionLocal, engine, get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from seed_data import seed_database  # noqa: E402


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


fastapi_app.dependency_overrides[get_db] = override_get_db


def _build_multipart(
    fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]
) -> tuple[bytes, str]:
    boundary = f"----TestBoundary{uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n"
            ).encode("utf-8")
        )
    for field_name, (filename, content, content_type) in files.items():
        chunks.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode("utf-8")
            + content
            + b"\r\n"
        )
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


async def _asgi_request(
    method: str,
    path: str,
    query_string: str = "",
    body: bytes = b"",
    headers: list[tuple[bytes, bytes]] | None = None,
) -> tuple[int, dict]:
    req_headers = headers or []
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": query_string.encode("utf-8"),
        "headers": req_headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    sent = False
    done_event = asyncio.Event()

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        await done_event.wait()
        return {"type": "http.disconnect"}

    status_code = 500
    response_chunks: list[bytes] = []

    async def send(message):
        nonlocal status_code
        if message["type"] == "http.response.start":
            status_code = message["status"]
        elif message["type"] == "http.response.body":
            response_chunks.append(message.get("body", b""))
            if not message.get("more_body", False):
                done_event.set()

    await fastapi_app(scope, receive, send)
    raw_bytes = b"".join(response_chunks)
    raw_body = raw_bytes.decode("utf-8", errors="replace")
    try:
        parsed = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError:
        parsed = {"raw": raw_body}
    return status_code, parsed


def request_json(
    method: str,
    path: str,
    payload: dict | None = None,
    query: str = "",
    token: str | None = None,
) -> tuple[int, dict | list]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else b""
    headers = [(b"content-type", b"application/json")] if payload is not None else []
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))
    return asyncio.run(
        _asgi_request(method, path, query_string=query, body=body, headers=headers)
    )


def request_multipart(
    path: str, fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]
) -> tuple[int, dict]:
    body, content_type = _build_multipart(fields, files)
    headers = [
        (b"content-type", content_type.encode("utf-8")),
        (b"content-length", str(len(body)).encode("utf-8")),
    ]
    return asyncio.run(_asgi_request("POST", path, body=body, headers=headers))


class HourglassMergedAPITest(unittest.TestCase):
    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
        self.created_uploads: list[Path] = []

    def tearDown(self) -> None:
        for file_path in self.created_uploads:
            if file_path.exists():
                file_path.unlink()

    def test_health_docs_static_and_catalogs(self):
        code, data = request_json("GET", "/")
        self.assertEqual(code, 200)
        self.assertIn("running successfully", data["message"])

        code_h, data_h = request_json("GET", "/health")
        self.assertEqual(code_h, 200)
        self.assertEqual(data_h["status"], "ok")

        code_docs, docs = request_json("GET", "/docs")
        self.assertEqual(code_docs, 200)
        self.assertIn("Swagger UI", docs["raw"])

        code_schema, spec = request_json("GET", "/openapi.json")
        self.assertEqual(code_schema, 200)
        self.assertIn("/api/jobs", spec["paths"])
        self.assertIn("/jobs", spec["paths"])
        self.assertIn("/users/login", spec["paths"])
        self.assertIn("/api/admin/jobs/{job_id}/remove", spec["paths"])

        code_ui, ui = request_json("GET", "/static/index.html")
        self.assertEqual(code_ui, 200)
        self.assertIn("Hourglass API", ui["raw"])

        for ep, key in (
            ("/api/students", "students"),
            ("/api/recruiters", "recruiters"),
            ("/api/categories", "categories"),
            ("/api/locations", "locations"),
            ("/api/application-statuses", "statuses"),
            ("/api/cvs", "cvs"),
            ("/api/availabilities", "availabilities"),
            ("/api/schedules", "schedules"),
        ):
            c, res = request_json("GET", ep)
            self.assertEqual(c, 200)
            self.assertGreater(len(res[key]), 0)

    def test_branch_b_jwt_auth_and_profiles_and_jobs(self):
        code_login, tokens = request_json(
            "POST",
            "/users/login",
            {"email": "employer1@gmail.com", "password": "123456"},
        )
        self.assertEqual(code_login, 200)
        access_token = tokens["access_token"]

        code_me, me_data = request_json("GET", "/users/me", token=access_token)
        self.assertEqual(code_me, 200)
        self.assertEqual(me_data["email"], "employer1@gmail.com")

        code_emp, emp_prof = request_json(
            "GET", "/users/profile/employer", token=access_token
        )
        self.assertEqual(code_emp, 200)
        self.assertEqual(emp_prof["company_name"], "Highlands Coffee")

        code_post, job_b = request_json(
            "POST",
            "/jobs",
            {
                "category_id": 1,
                "location_id": 2,
                "title": "Ca trưởng cửa hàng cà phê",
                "description": "Quản lý ca làm việc và hỗ trợ nhân viên part-time.",
                "salary_min": 35000,
                "salary_max": 45000,
                "job_type": "part-time",
            },
            token=access_token,
        )
        self.assertEqual(code_post, 201)
        self.assertEqual(job_b["status"], "pending")
        self.assertEqual(job_b["employer_id"], 4)
        self.assertEqual(job_b["recruiter_id"], 1)

        code_search, page_res = request_json("GET", "/jobs", query="page=1&page_size=10")
        self.assertEqual(code_search, 200)
        self.assertEqual(page_res["total"], 3)

    def test_users_and_profiles_creation(self):
        code, res = request_json(
            "POST",
            "/api/users",
            {
                "full_name": "Ngo Xuan Tai",
                "email": "Tai.NX@ptit.edu.vn",
                "password": "Password123",
                "role": "student",
                "university": "PTIT",
                "major": "CNTT",
            },
        )
        self.assertEqual(code, 201)
        self.assertEqual(res["user"]["email"], "tai.nx@ptit.edu.vn")
        self.assertNotIn("password", res["user"])

        _, students_res = request_json("GET", "/api/students")
        self.assertEqual(students_res["total"], 4)

        code_dup, _ = request_json(
            "POST",
            "/api/users",
            {
                "full_name": "Trung Email",
                "email": "tai.nx@ptit.edu.vn",
                "password": "Password123",
                "role": "student",
            },
        )
        self.assertEqual(code_dup, 409)

    def test_jobs_create_receive_update_and_admin_review(self):
        future_end = (date.today() + timedelta(days=30)).isoformat()
        code, res = request_json(
            "POST",
            "/api/jobs",
            {
                "recruiter_id": 1,
                "category_id": 4,
                "location_id": 2,
                "title": "Thuc tap sinh FastAPI",
                "description": "Phat trien API Python FastAPI cho he thong Hourglass.",
                "salary_min": 3000000,
                "salary_max": 5000000,
                "job_type": "internship",
                "end_date": future_end,
                "status": "approved",
            },
        )
        self.assertEqual(code, 201)
        created_id = res["job"]["id"]
        self.assertEqual(res["job"]["status"], "approved")

        code_404, _ = request_json(
            "POST",
            "/api/jobs",
            {
                "recruiter_id": 999,
                "category_id": 1,
                "location_id": 1,
                "title": "Test job",
                "description": "Mo ta cong viec du do dai hop le.",
            },
        )
        self.assertEqual(code_404, 404)

        code_sal, _ = request_json(
            "POST",
            "/api/jobs",
            {
                "recruiter_id": 1,
                "category_id": 1,
                "location_id": 1,
                "title": "Test salary range",
                "description": "Mo ta cong viec du do dai hop le.",
                "salary_min": 50000,
                "salary_max": 20000,
            },
        )
        self.assertEqual(code_sal, 422)

        code_list, list_res = request_json("GET", "/api/jobs", query="keyword=FastAPI")
        self.assertEqual(code_list, 200)
        self.assertEqual(list_res["jobs"][0]["id"], created_id)

        code_latest, latest_res = request_json("GET", "/api/jobs/latest")
        self.assertEqual(code_latest, 200)
        self.assertEqual(latest_res["jobs"][0]["id"], created_id)

        code_pend, pend_res = request_json(
            "GET", "/api/admin/jobs", query="status=pending"
        )
        self.assertEqual(code_pend, 200)
        self.assertEqual(pend_res["total"], 1)

        code_rev, rev_res = request_json(
            "PATCH",
            "/api/admin/jobs/4/review",
            {"status": "approved", "approved_by": 1},
        )
        self.assertEqual(code_rev, 200)
        self.assertEqual(rev_res["job"]["status"], "approved")

    def test_applications_upload_cv_logs_and_status_updates(self):
        code, res = request_multipart(
            "/api/applications",
            fields={
                "job_id": "3",
                "student_id": "1",
                "cover_letter": "Em mong muon ung tuyen vi tri ban hang.",
            },
            files={
                "cv_file": ("cv_an.pdf", b"%PDF-1.4 content", "application/pdf")
            },
        )
        self.assertEqual(code, 201)
        cv_url = res["application"]["cv_url"]
        self.assertTrue(cv_url.startswith("/uploads/cv_"))
        self.created_uploads.append(ROOT_DIR / cv_url.lstrip("/"))
        self.assertEqual(res["application"]["status_name"], "submitted")
        app_id = res["application"]["id"]

        code_dup, _ = request_multipart(
            "/api/applications",
            fields={"job_id": "3", "student_id": "1"},
            files={"cv_file": ("dup.pdf", b"%PDF-1.4 dup", "application/pdf")},
        )
        self.assertEqual(code_dup, 409)

        code_wrong_cv, _ = request_json(
            "POST",
            "/api/applications/json",
            {"student_id": 2, "job_id": 3, "cv_id": 1},
        )
        self.assertEqual(code_wrong_cv, 403)

        code_ext, _ = request_multipart(
            "/api/applications",
            fields={"job_id": "3", "student_id": "2"},
            files={"cv_file": ("bad.exe", b"MZ", "application/octet-stream")},
        )
        self.assertEqual(code_ext, 400)

        code_json, json_res = request_json(
            "POST",
            "/api/applications/json",
            {"student_id": 2, "job_id": 3, "cv_id": 2},
        )
        self.assertEqual(code_json, 201)
        self.assertEqual(json_res["application"]["cv_id"], 2)

        code_up, up_res = request_json(
            "PATCH",
            f"/api/applications/{app_id}/status",
            {"status": "interview", "note": "Moi phong van ngay mai"},
        )
        self.assertEqual(code_up, 200)
        self.assertEqual(up_res["application"]["status_name"], "interview")

        code_logs, logs_res = request_json(
            "GET", f"/api/applications/{app_id}/logs"
        )
        self.assertEqual(code_logs, 200)
        self.assertEqual(logs_res["total"], 2)

        code_bad, _ = request_json(
            "PATCH",
            f"/api/applications/{app_id}/status",
            {"status": "not_exist"},
        )
        self.assertEqual(code_bad, 422)

    def test_reviews_and_reputation(self):
        code_self, _ = request_json(
            "POST",
            "/api/reviews",
            {"reviewer_id": 1, "target_id": 1, "rating": 5},
        )
        self.assertEqual(code_self, 422)

        code, res = request_json(
            "POST",
            "/api/reviews",
            {
                "reviewer_id": 3,
                "target_id": 4,
                "job_id": 1,
                "rating": 4,
                "comment": "Moi truong tot",
            },
        )
        self.assertEqual(code, 201)
        self.assertEqual(res["review"]["rating"], 4)

        code_rep, rep = request_json("GET", "/api/users/4/reputation")
        self.assertEqual(code_rep, 200)
        self.assertEqual(rep["total_reviews"], 3)
        self.assertAlmostEqual(rep["average_rating"], 4.67, places=2)
        self.assertEqual(rep["reputation_badge"], "Rất uy tín")

        code_rep5, rep5 = request_json("GET", "/api/users/5/reputation")
        self.assertEqual(code_rep5, 200)
        self.assertEqual(rep5["reputation_badge"], "Cảnh báo uy tín thấp")

    def test_reports_admin_remove_and_statistics(self):
        code_rep, rep_res = request_json(
            "POST",
            "/api/reports",
            {
                "reporter_id": 2,
                "report_type": "job",
                "target_id": 1,
                "reason": "Thoi gian ca lam viec can bo sung chi tiet.",
            },
        )
        self.assertEqual(code_rep, 201)
        rep_id = rep_res["report"]["id"]

        code_dup, _ = request_json(
            "POST",
            "/api/reports",
            {
                "reporter_id": 2,
                "report_type": "job",
                "target_id": 1,
                "reason": "Gui lai khieu nai trung lap",
            },
        )
        self.assertEqual(code_dup, 409)

        code_list, list_res = request_json(
            "GET", "/api/admin/reports", query="status=pending"
        )
        self.assertEqual(code_list, 200)
        self.assertEqual(list_res["total"], 2)

        code_proc, proc_res = request_json(
            "PATCH",
            "/api/admin/reports/1",
            {"status": "rejected", "admin_note": "Tin nay da bi tu choi truoc do."},
        )
        self.assertEqual(code_proc, 200)
        self.assertEqual(proc_res["report"]["status"], "rejected")

        code_del, del_res = request_json(
            "DELETE",
            "/api/admin/jobs/1/remove",
            query="reason=Vi+pham+chinh+sach",
        )
        self.assertEqual(code_del, 200)
        self.assertEqual(del_res["job"]["status"], "rejected")
        self.assertEqual(del_res["resolved_reports_count"], 1)

        _, rep_after = request_json("GET", f"/api/admin/reports/{rep_id}")
        self.assertEqual(rep_after["report"]["status"], "resolved")

        code_stats, stats_res = request_json("GET", "/api/admin/statistics")
        self.assertEqual(code_stats, 200)
        stats = stats_res["statistics"]
        self.assertEqual(stats["users"]["total"], 6)
        self.assertEqual(stats["jobs"]["total"], 5)
        self.assertEqual(stats["jobs"]["rejected"], 2)
        self.assertEqual(stats["reports"]["pending"], 0)
        self.assertEqual(stats["applications"]["total"], 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
