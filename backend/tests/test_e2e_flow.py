"""
Kiểm thử luồng nghiệp vụ end-to-end với API thật (DB SQLite tạm, dữ liệu seed):
  NTD đăng tin -> Admin duyệt -> SV nộp CV (JSON + upload file) -> NTD duyệt hồ sơ
  -> KPI NTD & thống kê Admin cập nhật đúng.
Chạy:  cd backend && python -m unittest tests.test_e2e_flow -v
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

_TMP = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP.name) / 'e2e.db'}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


class E2EFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._ctx = TestClient(app)
        cls.c = cls._ctx.__enter__()  # chạy lifespan -> tạo bảng + seed

    @classmethod
    def tearDownClass(cls):
        cls._ctx.__exit__(None, None, None)
        from app.db.database import engine

        engine.dispose()

    def _login(self, email):
        r = self.c.post("/api/auth/login", json={"email": email, "password": "123456"})
        self.assertEqual(r.status_code, 200, r.text)
        d = r.json()
        return {"Authorization": "Bearer " + d["access_token"]}, d["user"]

    def test_full_flow(self):
        boot = self.c.get("/api/bootstrap").json()
        emp_profile = boot["employer_profiles"][0]
        rid = emp_profile["id"]
        emp_user = next(u for u in boot["users"] if u["id"] == emp_profile["user_id"])
        h_emp, _ = self._login(emp_user["email"])
        h_admin, _ = self._login("admin@gmail.com")

        kpi0 = self.c.get(f"/api/employer/{rid}/statistics", headers=h_emp)
        self.assertEqual(kpi0.status_code, 200, kpi0.text)
        kpi0 = kpi0.json()["statistics"]

        # 1. NTD tạo tin
        payload = {
            "recruiter_id": rid, "category_id": 1, "location_id": 1,
            "title": "Nhân viên phục vụ E2E", "description": "Phục vụ bàn ca tối, làm việc cuối tuần.",
            "requirements": "Chăm chỉ", "salary_min": 25000, "salary_max": 30000,
            "job_type": "part-time", "work_time": "Ca tối", "quantity": 2,
            "experience_level": "Không yêu cầu", "benefits": "Ăn ca", "status": "pending",
        }
        r = self.c.post("/api/jobs", json=payload, headers=h_emp)
        self.assertEqual(r.status_code, 201, r.text)
        job_id = r.json()["job"]["id"]

        # 2. NTD sửa tin + gửi duyệt lại; NTD không được tự duyệt
        r = self.c.patch(f"/api/jobs/{job_id}", json={"title": "Nhân viên phục vụ E2E (sửa)", "status": "pending"}, headers=h_emp)
        self.assertEqual(r.status_code, 200, r.text)
        r = self.c.patch(f"/api/jobs/{job_id}", json={"status": "approved"}, headers=h_emp)
        self.assertEqual(r.status_code, 403, r.text)

        # 3. Admin duyệt
        r = self.c.patch(
            f"/api/admin/jobs/{job_id}/review",
            json={"status": "approved", "approved_by": boot["admin_profiles"][0]["id"]}, headers=h_admin,
        )
        self.assertEqual(r.status_code, 200, r.text)

        # 4. SV nộp CV: (a) JSON dùng cv_url, (b) upload file
        h_st, st_user = self._login("student1@gmail.com")
        sid = next(s["id"] for s in boot["student_profiles"] if s["user_id"] == st_user["id"])
        r = self.c.post(
            "/api/applications/json",
            json={"student_id": sid, "job_id": job_id, "cv_url": "/uploads/sample_cv_tai.pdf", "cover_letter": "Em muốn ứng tuyển"},
            headers=h_st,
        )
        self.assertEqual(r.status_code, 201, r.text)
        app_id = r.json()["application"]["id"]
        # nộp trùng bị chặn
        r = self.c.post("/api/applications/json", json={"student_id": sid, "job_id": job_id, "cv_url": "/uploads/x.pdf"}, headers=h_st)
        self.assertEqual(r.status_code, 409, r.text)

        h_st2, st2 = self._login("student2@gmail.com")
        sid2 = next(s["id"] for s in boot["student_profiles"] if s["user_id"] == st2["id"])
        r = self.c.post(
            "/api/applications",
            data={"job_id": str(job_id), "student_id": str(sid2), "cover_letter": "upload file"},
            files={"cv_file": ("cv_e2e.pdf", b"%PDF-1.4 e2e", "application/pdf")},
            headers=h_st2,
        )
        self.assertEqual(r.status_code, 201, r.text)

        # 5. NTD duyệt hồ sơ
        for st in ("reviewing", "interview", "accepted"):
            r = self.c.patch(f"/api/applications/{app_id}/status", json={"status": st, "note": "e2e"}, headers=h_emp)
            self.assertEqual(r.status_code, 200, r.text)

        # 6. KPI NTD thay đổi đúng
        kpi1 = self.c.get(f"/api/employer/{rid}/statistics", headers=h_emp).json()["statistics"]
        self.assertEqual(kpi1["jobs"]["total"], kpi0["jobs"]["total"] + 1)
        self.assertEqual(kpi1["applications"]["total"], kpi0["applications"]["total"] + 2)
        self.assertEqual(kpi1["applications"]["accepted"], kpi0["applications"]["accepted"] + 1)
        self.assertEqual(kpi1["applications"]["new"], kpi0["applications"]["new"] + 1)

        # 7. Admin dashboard
        st = self.c.get("/api/admin/statistics", headers=h_admin)
        self.assertEqual(st.status_code, 200, st.text)
        stats = st.json()["statistics"]
        self.assertGreaterEqual(stats["applications"]["total"], 2)
        self.assertIn("approved", stats["jobs"])

        # 8. Phân quyền: SV không được duyệt tin
        r = self.c.patch(f"/api/admin/jobs/{job_id}/review", json={"status": "rejected", "approved_by": 1}, headers=h_st)
        self.assertEqual(r.status_code, 403, r.text)


if __name__ == "__main__":
    unittest.main()
