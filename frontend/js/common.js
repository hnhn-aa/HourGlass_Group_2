/* Tiện ích dùng chung: nạp api.js (module gọi API dùng chung), formatVND, Toast, đọc/ghi localStorage (nạp sau main.js) */
if (!window.HGApi && typeof document !== 'undefined') {
  document.write('<script src="js/api.js"><\/script>');
}
(function () {
  'use strict';
  var HG = window.HG;

  /* ---- localStorage an toàn (không lỗi khi bị chặn / đầy bộ nhớ) ---- */
  HG.store = {
    get: HG.read,
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  HG.write = HG.store.set;

  /* ================= Avatar / logo dùng chung =================
     HG.avatar(name, imageUrl, opts) → chuỗi HTML · HG.setAvatar(el, name, imageUrl, opts) → gán cho phần tử có sẵn
     - Luôn có lớp chữ viết tắt (VD "Nguyễn Văn An" → "NA", "Highlands Coffee" → "HC") trên nền pastel;
       nếu có ảnh hợp lệ thì <img object-fit: cover> phủ lên trên, ảnh lỗi → tự gỡ, lộ chữ viết tắt (không có icon ảnh vỡ).
     - opts: { type: 'person' | 'company', tag: 'span' | 'i', className: 'company-logo …', style: 'width:44px;…' } */
  var AVATAR_PALETTE = [
    ['#bcd2ff', '#f3c8e7', '#5260a1'],   // giống avatar "NN" ở topbar
    ['#d6e2ff', '#e6e0ff', '#4f5fc0'],
    ['#e3d8ff', '#f6dcf0', '#6a54c4'],
    ['#ffd9ea', '#ffe6d8', '#bf4f87'],
    ['#cdeee2', '#dbe8ff', '#2c8b6f'],
    ['#d3ecff', '#dfe3ff', '#2f74b0'],
    ['#ffe2c9', '#ffdbe8', '#b2661c']
  ];
  var COMPANY_PREFIX = /^(công ty|cong ty|cty|tnhh|cổ phần|co phan|cp|tập đoàn|tap doan|doanh nghiệp|dntn|chi nhánh|hộ kinh doanh|mtv|một thành viên|jsc|ltd|co\.?,?|inc\.?)\s+/i;
  HG.initials = function (name, type) {
    var words = String(name || '').normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (type === 'company') {
      var joined = words.join(' '), prev;
      do { prev = joined; joined = joined.replace(COMPANY_PREFIX, ''); } while (joined !== prev && joined.indexOf(' ') !== -1);
      words = joined.split(/\s+/).filter(Boolean);
    }
    if (!words.length) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('vi');
    var pick = type === 'company' ? [words[0], words[1]] : [words[0], words[words.length - 1]];
    return (pick[0].charAt(0) + pick[1].charAt(0)).toLocaleUpperCase('vi');
  };
  HG.avatarColors = function (seed) {
    var h = 0, str = String(seed || '');
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  };
  HG.avatarUrl = function (url) {
    if (!url || typeof url !== 'string' || !url.trim()) return '';
    if (typeof HG.resolveUploadUrl === 'function') return HG.resolveUploadUrl(url);
    var u = url.trim();
    return /^(https?:\/\/|\/uploads\/|data:image\/)/i.test(u) ? u : '';
  };
  function avatarParts(name, imageUrl, opts) {
    opts = opts || {};
    var c = HG.avatarColors(name), src = HG.avatarUrl(imageUrl);
    var style = 'background:linear-gradient(135deg,' + c[0] + ',' + c[1] + ');color:' + c[2] + ';' + (opts.style || '');
    var inner = '<span class="hg-avatar-txt" aria-hidden="true">' + HG.esc(HG.initials(name, opts.type)) + '</span>' +
      (src ? '<img class="hg-avatar-img" src="' + HG.esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '');
    return { style: style, inner: inner, label: String(name || '') };
  }
  HG.avatar = function (name, imageUrl, opts) {
    opts = opts || {};
    var tag = opts.tag === 'i' ? 'i' : 'span', p = avatarParts(name, imageUrl, opts);
    return '<' + tag + ' class="' + HG.esc(((opts.className || '') + ' hg-avatar').trim()) + '" style="' + HG.esc(p.style) + '" role="img" aria-label="' + HG.esc(p.label) + '" title="' + HG.esc(p.label) + '">' + p.inner + '</' + tag + '>';
  };
  HG.setAvatar = function (el, name, imageUrl, opts) {
    if (!el) return;
    var p = avatarParts(name, imageUrl, opts);
    el.classList.add('hg-avatar');
    el.style.cssText = (el.dataset.baseStyle != null ? el.dataset.baseStyle : (el.dataset.baseStyle = el.getAttribute('style') || '').replace(/background[^;]*;?/gi, '')) + ';' + p.style;
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', p.label); el.title = p.label;
    el.innerHTML = p.inner;
  };

  /* ---- Định dạng tiền: 25000 -> "25.000₫" (vi) / "25,000 VND" (en) ---- */
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }
  function isEn() { return typeof window.getCurrentLang === 'function' && window.getCurrentLang() === 'en'; }

  HG.formatVND = function (n) {
    n = Number(n);
    if (!isFinite(n)) return '';
    return isEn() ? (Math.round(n).toLocaleString('en-US') + ' VND') : (Math.round(n).toLocaleString('vi-VN') + '₫');
  };
  /* Dịch đơn vị lương tự do sang ngôn ngữ đang chọn ("30–40K/giờ" <-> "30–40K/hr", "Thỏa thuận" <-> "Negotiable") */
  HG.translateSalaryText = function (txt) {
    if (!txt) return '';
    var s = String(txt).trim();
    if (/^(thỏa thuận|thoả thuận|negotiable)$/i.test(s)) return tr('common.Negotiable', 'Thỏa thuận');
    if (isEn()) {
      return s
        .replace(/triệu\s*\/\s*tháng/gi, 'M VND/mo')
        .replace(/triệu/gi, 'M VND')
        .replace(/đ\s*\/\s*giờ|₫\s*\/\s*giờ/gi, ' VND/hr')
        .replace(/\/\s*giờ/gi, '/hr')
        .replace(/\/\s*tháng/gi, '/mo')
        .replace(/\/\s*buổi/gi, '/session')
        .replace(/\/\s*ca\b/gi, '/shift')
        .replace(/\/\s*ngày/gi, '/day');
    }
    return s;
  };
  /* Khoảng lương ngắn gọn: 25000–30000 -> "25–30K/giờ" (vi) / "25–30K/hr" (en), 4000000–5000000 -> "4–5 triệu/tháng" / "4–5M VND/mo" */
  HG.formatSalaryRange = function (min, max) {
    min = Number(min) || 0; max = Number(max) || min;
    if (!min && !max) return tr('common.Negotiable', 'Thỏa thuận');
    var m = max >= 1e6;
    var u = m ? 1e6 : 1e3;
    var suffix = m ? tr('common.unit_m_month', ' triệu/tháng') : tr('common.unit_k_hour', 'K/giờ');
    var f = function (v) { return +(v / u).toFixed(2); };
    return (min === max ? f(min) : f(min) + '–' + f(max)) + suffix;
  };
  /* Đọc "30–40K/giờ", "4-5 triệu", "250.000" ... -> { min, max } theo VND (null nếu không đọc được) */
  HG.parseSalary = function (text) {
    var s = String(text || '').toLowerCase().replace(/,/g, '.');
    var nums = s.match(/\d+(?:\.\d+)?/g);
    if (!nums) return null;
    var mult = /triệu|tr\b|m\b/.test(s) ? 1e6 : /k\b|nghìn|ngàn/.test(s) ? 1e3 : 0;
    var vals = nums.slice(0, 2).map(function (x) {
      if (/^\d{1,3}(\.\d{3})+$/.test(x)) return Number(x.replace(/\./g, ''));
      return Number(x) * (mult || 1);
    });
    if (!mult && vals.every(function (v) { return v < 1000; })) vals = vals.map(function (v) { return v * 1000; });
    return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
  };

  /* ---- Toast: HG.toast('Đã lưu', 'success' | 'error' | 'info') ---- */
  HG.toast = function (msg, type) {
    type = type || 'success';
    var box = document.getElementById('hg-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'hg-toasts'; box.className = 'hg-toasts';
      box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    var ico = { success: 'check', error: 'alert', info: 'sparkle' }[type] || 'check';
    var t = document.createElement('div');
    t.className = 'hg-toast ' + type;
    t.innerHTML = HG.icon(ico, 18) + '<span>' + HG.esc(msg) + '</span>';
    while (box.children.length >= 3) box.firstChild.remove();
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 250); }, 3200);
  };

  /* ---- Toast "chuyển trang": hiện ở trang kế tiếp (đăng nhập/đăng xuất...) ---- */
  HG.flash = function (msg, type) { try { sessionStorage.setItem('hg_flash', JSON.stringify({ msg: msg, type: type || 'success' })); } catch (e) {} };
  function showFlash() {
    var f = null;
    try { f = JSON.parse(sessionStorage.getItem('hg_flash')); sessionStorage.removeItem('hg_flash'); } catch (e) {}
    if (f && f.msg) setTimeout(function () { HG.toast(f.msg, f.type); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showFlash); else showFlash();

  /* ---- Đổi mật khẩu: kiểm tra mật khẩu cũ, độ dài, khớp xác nhận; đồng bộ tới Backend API ---- */
  HG.changePassword = function (cur, next, confirm) {
    var u = HG.user();
    if (!u) return { error: tr('common.pw_err_session', 'Phiên đăng nhập đã hết, hãy đăng nhập lại.'), field: 0 };
    if (!cur) return { error: tr('common.pw_err_cur_req', 'Vui lòng nhập mật khẩu hiện tại.'), field: 0 };
    if (u.password && cur !== u.password) return { error: tr('common.pw_err_cur_wrong', 'Mật khẩu hiện tại không đúng.'), field: 0 };
    if (!next) return { error: tr('common.pw_err_new_req', 'Vui lòng nhập mật khẩu mới.'), field: 1 };
    if (next.length < 6) return { error: tr('common.pw_err_new_len', 'Mật khẩu mới cần ít nhất 6 ký tự.'), field: 1 };
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return { error: tr('common.pw_err_new_alnum', 'Mật khẩu mới cần có cả chữ và số.'), field: 1 };
    if (next === cur) return { error: tr('common.pw_err_new_same', 'Mật khẩu mới phải khác mật khẩu hiện tại.'), field: 1 };
    if (next !== confirm) return { error: tr('common.pw_err_conf_mismatch', 'Mật khẩu xác nhận không khớp.'), field: 2 };
    var o = HG.read('hg_pw_overrides', {}); o[u.id] = next; HG.write('hg_pw_overrides', o);
    u.password = next;
    if (window.HGApi) {
      window.HGApi.changePassword(u.id, cur, next).catch(function () {});
    }
    return { ok: true };
  };

  /* ================= Thông báo (lưu bền, cập nhật gần thời gian thực) ================= */
  HG.notifs = function (uid) {
    return HG.read('hg_notifs', []).filter(function (n) { return n.uid === uid; }).sort(function (a, b) { return b.ts - a.ts; });
  };
  HG.notify = function (uid, text, o) {
    if (!uid) return;
    o = o || {};
    var all = HG.read('hg_notifs', []);
    all.unshift({ id: Date.now() + '-' + Math.floor(Math.random() * 1e4), uid: uid, text: text, ts: Date.now(), read: false, link: o.link || '', kind: o.kind || 'info' });
    HG.store.set('hg_notifs', all.slice(0, 120));
    document.dispatchEvent(new CustomEvent('hg:notify', { detail: { uid: uid } }));
  };
  HG.markNotifsRead = function (uid, id) {
    var all = HG.read('hg_notifs', []);
    all.forEach(function (n) { if (n.uid === uid && (!id || n.id === id)) n.read = true; });
    HG.store.set('hg_notifs', all);
    document.dispatchEvent(new CustomEvent('hg:notify', { detail: { uid: uid } }));
  };
  HG.timeAgo = function (ts) {
    var tr = function (k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; };
    var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 45) return tr('notif.just_now', 'Vừa xong');
    if (s < 3600) { var m = Math.floor(s / 60); return tr('notif.mins_ago', m + ' phút trước', { n: m }); }
    if (s < 86400) { var h = Math.floor(s / 3600); return tr('notif.hours_ago', h + ' giờ trước', { n: h }); }
    if (s < 172800) return tr('notif.yesterday', 'Hôm qua');
    var d = Math.floor(s / 86400);
    return tr('notif.days_ago', d + ' ngày trước', { n: d });
  };
  HG.seedNotifs = function (u) {
    if (!u || HG.read('hg_notif_seed_' + u.id, false)) return;
    var H = 3600000, seed = {
      student: [['Chào mừng bạn đến HourGlass! Hãy hoàn thiện hồ sơ và đăng ký ca rảnh để nhận gợi ý phù hợp.', 30 * H, 'student.html?tab=1'], ['Mẹo: Tải lên CV (PDF/DOCX) để ứng tuyển chỉ với một cú nhấp.', 26 * H, 'student.html?tab=2']],
      employer: [['Chào mừng bạn! Hãy đăng tin tuyển dụng đầu tiên để tiếp cận sinh viên.', 30 * H, 'employer.html?tab=3']],
      admin: [['Hệ thống sẵn sàng. Bạn sẽ nhận thông báo khi có tin tuyển dụng mới cần kiểm duyệt.', 30 * H, 'admin.html?tab=5']]
    }[u.role] || [];
    var all = HG.read('hg_notifs', []);
    seed.forEach(function (x, i) { all.push({ id: 'seed-' + u.id + '-' + i, uid: u.id, text: x[0], ts: Date.now() - x[1], read: i > 0, link: x[2], kind: 'info' }); });
    HG.store.set('hg_notifs', all); HG.store.set('hg_notif_seed_' + u.id, true);
  };

  /* ================= Nút bấm có spinner ================= */
  HG.busy = function (btn, fn, ms) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1';
    var html = btn.innerHTML, w = btn.offsetWidth;
    btn.style.minWidth = w + 'px';
    btn.classList.add('is-loading'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    var iconOnly = btn.classList.contains('save-btn') || btn.dataset.iconOnly || w < 48;
    btn.innerHTML = iconOnly ? '<span class="spinner" style="margin:0" aria-hidden="true"></span>' : '<span class="spinner" aria-hidden="true"></span><span>' + HG.esc(tr('common.processing', 'Đang xử lý…')) + '</span>';
    setTimeout(function () {
      var res; try { res = fn(); } catch (e) { console.error(e); HG.toast(tr('common.error_generic', 'Đã có lỗi xảy ra, vui lòng thử lại.'), 'error'); }
      if (document.body.contains(btn)) {
        btn.classList.remove('is-loading'); btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; btn.style.minWidth = ''; delete btn.dataset.busy;
      }
      return res;
    }, ms || 650);
  };

  /* ================= Empty state ================= */
  /* Nút bấm chờ Promise thật (gọi API): spinner hiển thị đến khi request kết thúc.
     HG.busyAsync(btn, function () { return HG.saveStudentProfile(...); }).then(function (res) { ... }) */
  HG.busyAsync = function (btn, fn) {
    if (btn && btn.dataset.busy) return Promise.resolve({ error: tr('common.busy_wait', 'Thao tác đang được xử lý, vui lòng chờ.'), busy: true });
    var html = btn ? btn.innerHTML : '';
    if (btn) {
      btn.dataset.busy = '1';
      btn.style.minWidth = btn.offsetWidth + 'px';
      btn.classList.add('is-loading'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + HG.esc(tr('common.processing', 'Đang xử lý…')) + '</span>';
    }
    function restore() {
      if (btn && document.body.contains(btn)) {
        btn.classList.remove('is-loading'); btn.disabled = false; btn.removeAttribute('aria-busy');
        btn.innerHTML = html; btn.style.minWidth = '';
      }
      if (btn) delete btn.dataset.busy;
    }
    var p;
    try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
    return p.then(function (r) { restore(); return r; }, function (e) {
      restore(); console.error(e);
      return { error: tr('common.error_generic', 'Đã có lỗi xảy ra, vui lòng thử lại.') };
    });
  };

  HG.empty = function (icon, title, text, actionHtml) {
    return '<div class="empty-state-card"><span class="empty-ico">' + HG.icon(icon || 'file', 26) + '</span><h3>' + HG.esc(title) + '</h3>' +
      (text ? '<p>' + HG.esc(text) + '</p>' : '') + (actionHtml ? '<div class="empty-act">' + actionHtml + '</div>' : '') + '</div>';
  };

  /* ================= Gợi ý tìm kiếm thông minh ================= */
  HG.attachSuggest = function (input, onPick) {
    if (!input || input.dataset.suggest) return;
    input.dataset.suggest = '1'; input.setAttribute('autocomplete', 'off');
    var box = document.createElement('div'); box.className = 'suggest-box'; box.hidden = true; box.setAttribute('role', 'listbox');
    var host = input.parentNode; if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(box);
    var idx = -1, items = [];
    function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'); }
    function build(q) {
      var n = norm(q).trim(); if (!n) return [];
      var out = [], seen = {};
      function add(kind, text, sub) { var k = kind + text; if (!seen[k] && out.length < 7 && norm(text).indexOf(n) !== -1) { seen[k] = 1; out.push({ kind: kind, text: text, sub: sub }); } }
      (window.HG_JOBS || []).forEach(function (j) { add('job', j.title, j.company); });
      job_categories.forEach(function (c) {
        var cName = HG.trVal ? HG.trVal('cat', c.name) : c.name;
        add('cat', cName, tr('common.suggest_cat', 'Ngành nghề'));
      });
      (window.HG_JOBS || []).forEach(function (j) { add('co', j.company, tr('common.suggest_employer', 'Nhà tuyển dụng')); });
      return out;
    }
    function render() {
      if (!items.length) { box.hidden = true; return; }
      box.innerHTML = items.map(function (it, i) {
        return '<div class="suggest-item' + (i === idx ? ' active' : '') + '" role="option" data-i="' + i + '">' + HG.icon(it.kind === 'job' ? 'briefcase' : it.kind === 'cat' ? 'sparkle' : 'users', 15) +
          '<span><b>' + HG.esc(it.text) + '</b><small>' + HG.esc(it.sub) + '</small></span></div>';
      }).join(''); box.hidden = false;
    }
    function pick(i) { var it = items[i]; if (!it) return; input.value = it.text; box.hidden = true; if (onPick) onPick(it); else input.dispatchEvent(new Event('input', { bubbles: true })); }
    input.addEventListener('input', function () { items = build(input.value); idx = -1; render(); });
    input.addEventListener('focus', function () { if (input.value) { items = build(input.value); render(); } });
    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { idx = (idx + 1) % items.length; render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = (idx - 1 + items.length) % items.length; render(); e.preventDefault(); }
      else if (e.key === 'Enter' && idx >= 0) { pick(idx); e.preventDefault(); }
      else if (e.key === 'Escape') box.hidden = true;
    });
    box.addEventListener('mousedown', function (e) { var it = e.target.closest('[data-i]'); if (it) { e.preventDefault(); pick(Number(it.dataset.i)); } });
    document.addEventListener('click', function (e) { if (e.target !== input && !box.contains(e.target)) box.hidden = true; });
  };

  /* ================= Popup nhập lý do (dùng cho từ chối / khóa) ================= */
  HG.askReason = function (o) {
    o = o || {}; var min = o.min == null ? 10 : o.min;
    return new Promise(function (resolve) {
      var done = false;
      HG.modal.open({
        className: 'modal-reason', dismissible: true, labelledBy: 'reason-title',
        html: '<h2 id="reason-title">' + HG.esc(o.title || tr('common.ask_reason_title', 'Nhập lý do')) + '</h2>' + (o.subtitle ? '<p style="margin-bottom:14px">' + o.subtitle + '</p>' : '') +
          '<form data-form novalidate><label>' + HG.esc(o.label || tr('common.ask_reason_label', 'Lý do')) + ' <span class="req-star">*</span><textarea name="reason" rows="4" maxlength="300" placeholder="' + HG.esc(o.placeholder || '') + '"></textarea></label>' +
          (o.quick ? '<div class="quick-reasons">' + o.quick.map(function (q) { return '<button type="button" data-qr="' + HG.esc(q) + '">' + HG.esc(q) + '</button>'; }).join('') + '</div>' : '') +
          '<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-cancel>' + HG.esc(tr('common.cancel', 'Hủy')) + '</button>' +
          '<button type="submit" class="primary-btn' + (o.danger ? ' danger' : '') + '">' + HG.esc(o.confirmText || tr('common.confirm', 'Xác nhận')) + '</button></div></form>',
        onMount: function (api) {
          var f = api.box.querySelector('form'), err = api.box.querySelector('.form-error');
          api.box.querySelector('[data-cancel]').addEventListener('click', function () { api.close(false); });
          api.box.addEventListener('click', function (e) { var q = e.target.closest('[data-qr]'); if (q) { f.reason.value = q.dataset.qr; f.reason.focus(); } });
          f.addEventListener('submit', function (e) {
            e.preventDefault(); var r = f.reason.value.trim();
            if (r.length < min) { err.textContent = tr('common.ask_reason_min_err', 'Vui lòng nhập lý do (ít nhất ' + min + ' ký tự).', { min: min }); f.reason.focus(); return; }
            HG.busy(f.querySelector('[type=submit]'), function () { done = true; api.close(true); resolve(r); }, 600);
          });
        },
        onClose: function () { if (!done) resolve(null); }
      });
    });
  };

  /* Form hồ sơ / mật khẩu / tùy chọn: tự hiện spinner khi bấm lưu rồi mới xử lý */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.matches || !f.matches('#student-profile-form,#employer-profile-form,#pw-form,#emp-pw-form,#pref-form,#emp-pref-form')) return;
    if (f.dataset.pass) { delete f.dataset.pass; return; }
    e.preventDefault(); e.stopImmediatePropagation();
    var btn = f.querySelector('[type=submit]'); if (!btn) return;
    HG.busy(btn, function () { f.dataset.pass = '1'; f.requestSubmit(); }, 500);
  }, true);

  /* ---- Form "Gửi tin nhắn cho chúng tôi" (about.html#contact) ----
     Backend chưa có endpoint liên hệ, nên phản hồi được kiểm tra hợp lệ rồi lưu tạm
     vào localStorage "hg_contact_messages" (giữ 50 tin gần nhất). */
  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var fields = [].slice.call(form.querySelectorAll('[data-rules]'));

    function validate(el) {
      var v = el.value, err = '';
      if (window.HGValidate) err = HGValidate.check(v, el.dataset.rules, { label: el.dataset.label || '', form: form });
      else if (!v.trim()) err = 'Vui lòng nhập ' + (el.dataset.label || 'thông tin') + '.';
      else if (el.type === 'email' && !EMAIL.test(v.trim())) err = 'Email không hợp lệ (ví dụ: ban@email.com).';
      var box = document.getElementById(el.id + '-err');
      if (box) box.textContent = err;
      el.classList.toggle('invalid', !!err);
      el.setAttribute('aria-invalid', err ? 'true' : 'false');
      return !err;
    }

    fields.forEach(function (el) {
      el.addEventListener('blur', function () { if (el.value.trim()) validate(el); });
      el.addEventListener('input', function () { if (el.classList.contains('invalid')) validate(el); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      fields.forEach(function (el) { if (!validate(el) && !firstBad) firstBad = el; });
      if (firstBad) {
        firstBad.focus();
        HG.toast(typeof window.t === 'function' ? window.t('about.contact_check_err') : 'Vui lòng kiểm tra lại thông tin trong form liên hệ.', 'error');
        return;
      }
      var btn = form.querySelector('[type=submit]');
      var msg = {
        id: 'c-' + Date.now(),
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim(),
        user_id: (HG.user && HG.user()) ? HG.user().id : null,
        created_at: new Date().toISOString()
      };
      var send = function () {
        var list = HG.read('hg_contact_messages', []);
        if (!Array.isArray(list)) list = [];
        list.push(msg);
        HG.write('hg_contact_messages', list.slice(-50));
        form.reset();
        fields.forEach(function (el) {
          el.classList.remove('invalid'); el.removeAttribute('aria-invalid');
          var box = document.getElementById(el.id + '-err'); if (box) box.textContent = '';
        });
        var okMsg = typeof window.t === 'function'
          ? window.t('about.contact_success', { name: msg.name })
          : ('Cảm ơn ' + msg.name + '! Đội ngũ HourGlass sẽ phản hồi qua email trong vòng 24 giờ.');
        HG.toast(okMsg, 'success');
      };
      if (HG.busy && btn) HG.busy(btn, send, 600); else send();
    });
    window.addEventListener('languageChanged', function () {
      fields.forEach(function (el) { if (el.classList.contains('invalid')) validate(el); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initContactForm);
  else initContactForm();

  /* ---- Gắn nút chuyển đổi ngôn ngữ VI | EN vào Header Dashboard & Trang Auth (nếu chưa có) ---- */
  function injectAuxLangSwitchers() {
    if (!window.HGI18n || typeof window.HGI18n.renderSwitcher !== 'function') return;
    /* Dashboard topbar (student.html, employer.html, admin.html) */
    var dashRight = document.querySelector('.dash-header > div:last-child');
    if (dashRight && !dashRight.querySelector('.lang-switch')) {
      dashRight.insertAdjacentHTML('afterbegin', window.HGI18n.renderSwitcher('lang-switch--dash'));
    }
    /* Trang Đăng nhập / Đăng ký (auth.html) */
    var authMain = document.querySelector('.auth-main');
    if (authMain && !authMain.querySelector('.lang-switch')) {
      var backLink = authMain.querySelector('.back-link');
      if (backLink) {
        var bar = document.createElement('div');
        bar.className = 'auth-topbar';
        backLink.parentNode.insertBefore(bar, backLink);
        bar.appendChild(backLink);
        bar.insertAdjacentHTML('beforeend', window.HGI18n.renderSwitcher('lang-switch--auth'));
      }
    }
    if (typeof window.applyTranslations === 'function') {
      window.applyTranslations(document);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectAuxLangSwitchers);
  else injectAuxLangSwitchers();
})();
