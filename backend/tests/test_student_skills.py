"""
Kiểm thử đồng bộ "Kỹ năng & Thế mạnh" (student_profiles.skills) với API thật (SQLite tạm, dữ liệu seed):
  DB lưu chuỗi JSON  ⇄  API nhận/trả mảng chuỗi.
Chạy:  cd backend && python -m unittest tests.test_student_skills -v
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

_TMP = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP.name) / 'skills.db'}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


class StudentSkillsSync(unittest.TestCase):
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

    def _profile(self, user_id):
        boot = self.c.get("/api/bootstrap").json()
        return next(s for s in boot["student_profiles"] if s["user_id"] == user_id)

    def test_skills_round_trip(self):
        headers, user = self._login("student1@gmail.com")
        sp = self._profile(user["id"])
        self.assertIsInstance(sp["skills"], list, "bootstrap phải trả skills dạng mảng")

        # Cập nhật CHỈ skills: chuẩn hóa khoảng trắng + bỏ trùng không phân biệt hoa/thường
        r = self.c.put(
            f"/api/students/{sp['id']}",
            json={"skills": ["  Tiếng  Anh ", "tiếng anh", "Pha chế, Barista", "Canva"]},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        expected = ["Tiếng Anh", "Pha chế, Barista", "Canva"]
        self.assertEqual(r.json()["student"]["skills"], expected)

        # Các trường khác không bị ảnh hưởng
        after = self._profile(user["id"])
        self.assertEqual(after["skills"], expected)
        for field in ("university", "major", "bio", "address"):
            self.assertEqual(after[field], sp[field], field)

        # DB lưu chuỗi JSON (giữ tiếng Việt có dấu)
        from app.db.database import SessionLocal
        from app.models.profile import StudentProfile

        db = SessionLocal()
        try:
            raw = db.get(StudentProfile, sp["id"]).skills
        finally:
            db.close()
        self.assertEqual(json.loads(raw), expected)
        self.assertIn("Tiếng Anh", raw)

        # Lưu hồ sơ không gửi skills → giữ nguyên kỹ năng
        r = self.c.put(f"/api/students/{sp['id']}", json={"major": "CNTT"}, headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["student"]["skills"], expected)

        # Xóa hết → mảng rỗng (khác null)
        r = self.c.put(f"/api/students/{sp['id']}", json={"skills": []}, headers=headers)
        self.assertEqual(r.json()["student"]["skills"], [])
        self.assertEqual(self._profile(user["id"])["skills"], [])

        # Endpoint /users/profile/student cũng nhận/trả mảng
        r = self.c.put("/users/profile/student", json={"skills": ["Bán hàng"]}, headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["skills"], ["Bán hàng"])
        self.assertEqual(self.c.get("/users/profile/student", headers=headers).json()["skills"], ["Bán hàng"])

    def test_invalid_skills_rejected(self):
        headers, user = self._login("student1@gmail.com")
        sp = self._profile(user["id"])
        r = self.c.put(f"/api/students/{sp['id']}", json={"skills": ["x" * 41]}, headers=headers)
        self.assertEqual(r.status_code, 400, r.text)
        r = self.c.put(f"/api/students/{sp['id']}", json={"skills": [f"KN {i}" for i in range(21)]}, headers=headers)
        self.assertEqual(r.status_code, 400, r.text)
        r = self.c.put("/users/profile/student", json={"skills": ["x" * 41]}, headers=headers)
        self.assertEqual(r.status_code, 422, r.text)


if __name__ == "__main__":
    unittest.main()
