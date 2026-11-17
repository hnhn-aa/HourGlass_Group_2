/* Tiện ích dùng chung: formatVND, Toast, đọc/ghi localStorage (nạp sau main.js) */
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

  /* ---- Định dạng tiền: 25000 -> "25.000₫" ; 4500000 -> "4.500.000₫" ---- */
  HG.formatVND = function (n) {
    n = Number(n);
    if (!isFinite(n)) return '';
    return Math.round(n).toLocaleString('vi-VN') + '₫';
  };
  /* Khoảng lương ngắn gọn: 25000–30000 -> "25–30K/giờ", 4000000–5000000 -> "4–5 triệu/tháng" */
  HG.formatSalaryRange = function (min, max) {
    min = Number(min) || 0; max = Number(max) || min;
    if (!min && !max) return 'Thỏa thuận';
    var m = max >= 1e6;
    var u = m ? 1e6 : 1e3, suffix = m ? ' triệu/tháng' : 'K/giờ';
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
      // "250.000" (dấu chấm ngăn cách nghìn) -> 250000
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
    while (box.children.length >= 3) box.firstChild.remove();   // tối đa 3 toast cùng lúc
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

  /* ---- Đổi mật khẩu: kiểm tra mật khẩu cũ, độ dài, khớp xác nhận; lưu lại để đăng nhập lần sau ---- */
  HG.changePassword = function (cur, next, confirm) {
    var u = HG.user();
    if (!u) return { error: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.', field: 0 };
    if (!cur) return { error: 'Vui lòng nhập mật khẩu hiện tại.', field: 0 };
    if (cur !== u.password) return { error: 'Mật khẩu hiện tại không đúng.', field: 0 };
    if (!next) return { error: 'Vui lòng nhập mật khẩu mới.', field: 1 };
    if (next.length < 6) return { error: 'Mật khẩu mới cần ít nhất 6 ký tự.', field: 1 };
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return { error: 'Mật khẩu mới cần có cả chữ và số.', field: 1 };
    if (next === cur) return { error: 'Mật khẩu mới phải khác mật khẩu hiện tại.', field: 1 };
    if (next !== confirm) return { error: 'Mật khẩu xác nhận không khớp.', field: 2 };
    var o = HG.read('hg_pw_overrides', {}); o[u.id] = next; HG.write('hg_pw_overrides', o);
    u.password = next;
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
    var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 45) return 'Vừa xong'; if (s < 3600) return Math.floor(s / 60) + ' phút trước';
    if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
    if (s < 172800) return 'Hôm qua'; return Math.floor(s / 86400) + ' ngày trước';
  };
  /* Tạo vài thông báo chào mừng cho lần đầu vào không gian cá nhân */
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

  /* ================= Nút bấm có spinner =================
     HG.busy(btn, function(){ ...xử lý...; return false nếu lỗi }, ms) */
  HG.busy = function (btn, fn, ms) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1';
    var html = btn.innerHTML, w = btn.offsetWidth;
    btn.style.minWidth = w + 'px';
    btn.classList.add('is-loading'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    var iconOnly = btn.classList.contains('save-btn') || btn.dataset.iconOnly || w < 48;
    btn.innerHTML = iconOnly ? '<span class="spinner" style="margin:0" aria-hidden="true"></span>' : '<span class="spinner" aria-hidden="true"></span><span>Đang xử lý…</span>';
    setTimeout(function () {
      var res; try { res = fn(); } catch (e) { console.error(e); HG.toast('Đã có lỗi xảy ra, vui lòng thử lại.', 'error'); }
      if (document.body.contains(btn)) {
        btn.classList.remove('is-loading'); btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; btn.style.minWidth = ''; delete btn.dataset.busy;
      }
      return res;
    }, ms || 650);
  };

  /* ================= Empty state ================= */
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
      job_categories.forEach(function (c) { add('cat', c.name, 'Ngành nghề'); });
      (window.HG_JOBS || []).forEach(function (j) { add('co', j.company, 'Nhà tuyển dụng'); });
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

  /* ================= Popup nhập lý do (dùng cho từ chối / khóa) =================
     HG.askReason({title, subtitle, label, placeholder, quick:[...], confirmText, danger, min}) -> Promise<string|null> */
  HG.askReason = function (o) {
    o = o || {}; var min = o.min == null ? 10 : o.min;
    return new Promise(function (resolve) {
      var done = false;
      HG.modal.open({
        className: 'modal-reason', dismissible: true, labelledBy: 'reason-title',
        html: '<h2 id="reason-title">' + HG.esc(o.title || 'Nhập lý do') + '</h2>' + (o.subtitle ? '<p style="margin-bottom:14px">' + o.subtitle + '</p>' : '') +
          '<form data-form novalidate><label>' + HG.esc(o.label || 'Lý do') + ' <span class="req-star">*</span><textarea name="reason" rows="4" maxlength="300" placeholder="' + HG.esc(o.placeholder || '') + '"></textarea></label>' +
          (o.quick ? '<div class="quick-reasons">' + o.quick.map(function (q) { return '<button type="button" data-qr="' + HG.esc(q) + '">' + HG.esc(q) + '</button>'; }).join('') + '</div>' : '') +
          '<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-cancel>Hủy</button>' +
          '<button type="submit" class="primary-btn' + (o.danger ? ' danger' : '') + '">' + HG.esc(o.confirmText || 'Xác nhận') + '</button></div></form>',
        onMount: function (api) {
          var f = api.box.querySelector('form'), err = api.box.querySelector('.form-error');
          api.box.querySelector('[data-cancel]').addEventListener('click', function () { api.close(false); });
          api.box.addEventListener('click', function (e) { var q = e.target.closest('[data-qr]'); if (q) { f.reason.value = q.dataset.qr; f.reason.focus(); } });
          f.addEventListener('submit', function (e) {
            e.preventDefault(); var r = f.reason.value.trim();
            if (r.length < min) { err.textContent = 'Vui lòng nhập lý do (ít nhất ' + min + ' ký tự).'; f.reason.focus(); return; }
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
})();
