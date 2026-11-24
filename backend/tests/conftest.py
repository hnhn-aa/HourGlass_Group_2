"""Cấu hình pytest cho thư mục backend/tests.

- Đảm bảo import được package `app` khi chạy `pytest` từ thư mục backend/.
- In bảng báo cáo PASS/FAIL từng bước của kiểm thử hồi quy (tests/test_regression_roles.py)
  ở cuối phiên chạy, kể cả khi pytest đang thu giữ (capture) stdout.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    module = sys.modules.get("tests.test_regression_roles") or sys.modules.get("test_regression_roles")
    if module is None or not getattr(module, "REPORT", None):
        return
    terminalreporter.write_sep("=", "Báo cáo kiểm thử hồi quy theo vai trò")
    for line in module.format_report().splitlines():
        if line.lstrip().startswith(("FAIL", "↳")):
            terminalreporter.write_line(line, red=True)
        elif line.lstrip().startswith("SKIP"):
            terminalreporter.write_line(line, yellow=True)
        else:
            terminalreporter.write_line(line)
