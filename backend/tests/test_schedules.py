"""
Kiểm thử Lịch làm việc (schedules): thêm / sửa / xóa ca, phát hiện trùng lịch và quyền sở hữu.
Dùng SQLite tạm + dữ liệu seed (student1@gmail.com, student2@gmail.com – mật khẩu 123456).
Chạy:  cd backend && python -m unittest tests.test_schedules -v
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
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP.name) / 'schedules.db'}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DAY = "2031-03-10"   # ngày xa trong tương lai -> không đụng lịch có sẵn trong dữ liệu seed


def at(hhmm, day=DAY):
    return f"{day}T{hhmm}:00"


class ScheduleCrudAndOverlap(unittest.TestCase):
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

    def _student_id(self, user_id):
        boot = self.c.get("/api/bootstrap").json()
        return next(s["id"] for s in boot["student_profiles"] if s["user_id"] == user_id)

    def _create(self, headers, sid, start, end, title="Ca kiểm thử"):
        return self.c.post(
            "/api/schedules",
            json={"student_id": sid, "title": title, "start_datetime": start, "end_datetime": end},
            headers=headers,
        )

    def test_crud_and_overlap(self):
        headers, user = self._login("student1@gmail.com")
        sid = self._student_id(user["id"])

        # Thêm ca 08:00–12:00
        r = self._create(headers, sid, at("08:00"), at("12:00"), "Ca sáng")
        self.assertEqual(r.status_code, 201, r.text)
        first = r.json()["schedule"]

        # Trùng giờ (10:00–14:00) -> 409, kèm tên ca bị trùng
        r = self._create(headers, sid, at("10:00"), at("14:00"))
        self.assertEqual(r.status_code, 409, r.text)
        self.assertIn("Ca sáng", r.json()["detail"])

        # Nối tiếp ngay sau (12:00–17:00) -> hợp lệ
        r = self._create(headers, sid, at("12:00"), at("17:00"), "Ca chiều")
        self.assertEqual(r.status_code, 201, r.text)
        second = r.json()["schedule"]

        # Sửa ca chiều chồng lên ca sáng -> 409; dữ liệu không đổi
        r = self.c.put(f"/api/schedules/{second['id']}", json={"start_datetime": at("11:00")}, headers=headers)
        self.assertEqual(r.status_code, 409, r.text)

        # Sửa hợp lệ (đổi giờ + tiêu đề); so trùng bỏ qua chính nó
        r = self.c.put(
            f"/api/schedules/{second['id']}",
            json={"title": "Ca chiều (đổi giờ)", "start_datetime": at("13:00"), "end_datetime": at("18:00")},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["schedule"]["title"], "Ca chiều (đổi giờ)")

        # Giờ kết thúc trước giờ bắt đầu -> 422
        r = self.c.put(f"/api/schedules/{second['id']}", json={"end_datetime": at("09:00")}, headers=headers)
        self.assertEqual(r.status_code, 422, r.text)

        # Sinh viên khác không được sửa / xóa / tạo lịch cho student1 -> 403
        other_headers, _ = self._login("student2@gmail.com")
        self.assertEqual(self.c.delete(f"/api/schedules/{first['id']}", headers=other_headers).status_code, 403)
        self.assertEqual(
            self.c.put(f"/api/schedules/{first['id']}", json={"title": "Sửa trộm"}, headers=other_headers).status_code, 403
        )
        self.assertEqual(self._create(other_headers, sid, at("19:00"), at("21:00")).status_code, 403)

        # Xóa ca sáng -> khung giờ trống lại, tạo lại được
        r = self.c.delete(f"/api/schedules/{first['id']}", headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        r = self._create(headers, sid, at("09:00"), at("11:00"), "Ca sáng mới")
        self.assertEqual(r.status_code, 201, r.text)

        listed = self.c.get(f"/api/schedules?student_id={sid}").json()["schedules"]
        titles = {s["title"] for s in listed if s["start_datetime"].startswith(DAY)}
        self.assertEqual(titles, {"Ca sáng mới", "Ca chiều (đổi giờ)"})


if __name__ == "__main__":
    unittest.main()
