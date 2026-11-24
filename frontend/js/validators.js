/* =========================================================
   validators.js – Quy tắc kiểm tra dữ liệu đầu vào (thuần hàm, không đụng DOM)

   Khai báo quy tắc trong HTML:  <input data-rules="required|email|min:8|match:password">
   Dùng:  HGValidate.check(giáTrị, 'required|email', { label:'email', form })  -> '' hoặc thông báo lỗi
   ========================================================= */
(function () {
  'use strict';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;   // SĐT di động Việt Nam: 0912345678 hoặc +84912345678

  function tr(key, fallback, params) {
    return typeof window.t === 'function' ? window.t(key, params) : fallback;
  }

  function translateLabel(rawLabel) {
    if (!rawLabel) return tr('val.default_field', 'thông tin này');
    var k = 'val.label.' + String(rawLabel).toLowerCase();
    var res = typeof window.t === 'function' ? window.t(k) : k;
    return res !== k ? res : rawLabel;
  }

  /* Mỗi quy tắc nhận (giá trị, đối số, ngữ cảnh) và trả về chuỗi lỗi, rỗng nếu hợp lệ.
     Trừ "required", các quy tắc bỏ qua ô trống để tách bạch "bắt buộc" và "đúng định dạng". */
  var RULES = {
    required: function (v, a, c) {
      var lbl = translateLabel(c.label);
      return v.trim() ? '' : tr('val.required', 'Vui lòng nhập ' + lbl + '.', { label: lbl });
    },
    email: function (v) {
      return !v.trim() || EMAIL.test(v.trim()) ? '' : tr('val.email', 'Email không hợp lệ (ví dụ: ban@email.com).');
    },
    phone: function (v) {
      return !v.trim() || PHONE.test(v.replace(/[\s.-]/g, '')) ? '' : tr('val.phone', 'Số điện thoại không hợp lệ (ví dụ: 0912345678).');
    },
    min: function (v, a, c) {
      if (!v || v.trim().length >= +a) return '';
      var lbl = translateLabel(c.label);
      var cap = lbl.charAt(0).toUpperCase() + lbl.slice(1);
      return tr('val.min', cap + ' phải có ít nhất ' + a + ' ký tự.', { label: cap, min: a });
    },
    fullname: function (v) {
      return !v.trim() || v.trim().split(/\s+/).length >= 2 ? '' : tr('val.fullname', 'Vui lòng nhập đầy đủ họ và tên.');
    },
    password: function (v) {
      return !v || (/[A-Za-z]/.test(v) && /\d/.test(v)) ? '' : tr('val.password', 'Mật khẩu cần có cả chữ và số.');
    },
    match: function (v, a, c) {                       // giống giá trị của ô có name = a
      var other = c.form && c.form.elements[a];
      return !v || !other || v === other.value ? '' : tr('val.match', 'Mật khẩu xác nhận không khớp.');
    },
    checked: function (v, a, c) {
      if (c.checked) return '';
      if (c.label && c.label.indexOf('Điều khoản') !== -1) {
        return tr('auth.agree_err', c.label);
      }
      return c.label;
    }
  };

  /* Chạy lần lượt các quy tắc "a|b:x|c", trả về lỗi đầu tiên */
  function check(value, ruleStr, ctx) {
    var list = (ruleStr || '').split('|');
    for (var i = 0; i < list.length; i++) {
      var p = list[i].split(':'), fn = RULES[p[0]];
      if (!fn) continue;
      var err = fn(value == null ? '' : String(value), p[1], ctx || {});
      if (err) return err;
    }
    return '';
  }

  /* Độ mạnh mật khẩu: 0 (trống) – 4 (rất mạnh) + nhãn hiển thị */
  function strength(pw) {
    if (!pw) return { score: 0, label: '' };
    var s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    s = Math.max(1, s);
    var labels = [
      '',
      tr('val.pw_weak', 'Yếu'),
      tr('val.pw_medium', 'Trung bình'),
      tr('val.pw_good', 'Khá'),
      tr('val.pw_strong', 'Mạnh')
    ];
    return { score: s, label: labels[s] };
  }

  window.HGValidate = { check: check, strength: strength, RULES: RULES };
})();
