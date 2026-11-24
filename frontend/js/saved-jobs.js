/* =========================================================
   saved-jobs.js – Việc làm đã lưu & Đã xem gần đây (localStorage)
   ---------------------------------------------------------
   localStorage:
     hourglass_saved_jobs   [{ uid, id, title, company, location, salary, logo, color, saved_at }]
     hourglass_recent_jobs  [{ uid, id, title, company, location, salary, logo, color, viewed_at }]
       - uid: tài khoản sở hữu mục (0 = khách chưa đăng nhập) -> mỗi tài khoản một danh sách
       - Lưu kèm "ảnh chụp" thông tin tin tuyển dụng để vẫn hiển thị được khi tin
         không còn trong danh sách công khai (hết hạn / bị gỡ).
       - Đã xem gần đây: tối đa 10 tin / tài khoản, tin mới nhất ở đầu, không trùng lặp.

   API (window.HG.savedJobs):
     list() / ids() / has(id) / toggle(id) / add(id) / remove(id) / clear()
     recent() / addRecent(jobOrId) / removeRecent(id) / clearRecent()
     paint(root?)  tô lại mọi nút lưu đang hiển thị
   Đồng thời thay phần lõi HG.getSaved / HG.isSaved / HG.toggleSaved (main.js) để
   mọi nút lưu cũ dùng chung kho này; adapter.js vẫn bọc toggleSaved để đồng bộ
   lên Backend (POST /api/job-saves/toggle).

   Sự kiện: document 'hg:saved-change' { detail: { kind: 'saved'|'recent', id, saved } }
   – phát cả khi thay đổi đến từ tab trình duyệt khác (sự kiện storage).
   Nạp ngay sau main.js (trước common.js / adapter.js).
   ========================================================= */
(function () {
  'use strict';
  var HG = window.HG;
  if (!HG) return;

  var KEY_SAVED = 'hourglass_saved_jobs';
  var KEY_RECENT = 'hourglass_recent_jobs';
  var KEY_INIT = 'hourglass_saved_jobs_init';   /* uid đã được khởi tạo từ dữ liệu cũ / Backend */
  var MAX_RECENT = 10;
  var MAX_ENTRIES = 300;                          /* chặn phình localStorage khi nhiều tài khoản dùng chung máy */

  function readList(k) {
    try { var v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function writeList(k, list) {
    try { localStorage.setItem(k, JSON.stringify(list.slice(0, MAX_ENTRIES))); return true; }
    catch (e) {
      var msg = typeof window.t === 'function' ? window.t('common.storage_full') : 'Bộ nhớ trình duyệt đã đầy, không thể lưu thêm.';
      if (HG.toast) HG.toast(msg, 'error');
      return false;
    }
  }
  function uid() { var u = HG.user && HG.user(); return u ? u.id : 0; }
  function nowIso() { return new Date().toISOString(); }
  function emit(kind, id, saved) {
    try { document.dispatchEvent(new CustomEvent('hg:saved-change', { detail: { kind: kind, id: id, saved: saved } })); } catch (e) {}
  }

  /* Ảnh chụp thông tin tin tuyển dụng tại thời điểm lưu / xem */
  function snapshot(jobOrId) {
    var id = typeof jobOrId === 'object' && jobOrId ? Number(jobOrId.id) : Number(jobOrId);
    var card = typeof jobOrId === 'object' && jobOrId && jobOrId.company ? jobOrId : null;
    if (!card && typeof jobs !== 'undefined' && HG.toJob) {
      var raw = jobs.find(function (j) { return j.id === id; });
      if (raw) { try { card = HG.toJob(raw); } catch (e) { card = null; } }
    }
    var s = { id: id };
    if (card) {
      s.title = card.title; s.company = card.company; s.location = card.location;
      s.salary = card.salary; s.logo = card.logo; s.color = card.color;
    }
    return s;
  }
  function withSnapshot(entry, jobOrId) {
    var s = snapshot(jobOrId || entry.id);
    Object.keys(s).forEach(function (k) { if (s[k] != null && s[k] !== '') entry[k] = s[k]; });
    return entry;
  }

  /* ── Khởi tạo một lần cho mỗi tài khoản: chuyển dữ liệu từ khóa cũ hg_saved_<uid> ── */
  function migrateLegacy(u) {
    if (!u) return;
    var done = readList(KEY_INIT);
    if (done.indexOf(u) !== -1) return;
    var legacy = null;
    try { legacy = JSON.parse(localStorage.getItem('hg_saved_' + u)); } catch (e) {}
    if (Array.isArray(legacy) && legacy.length) {
      var all = readList(KEY_SAVED), mine = {};
      all.forEach(function (x) { if (x.uid === u) mine[x.id] = true; });
      legacy.forEach(function (jid) {
        jid = Number(jid);
        if (jid && !mine[jid]) all.push(withSnapshot({ uid: u, id: jid, saved_at: nowIso() }));
      });
      writeList(KEY_SAVED, all);
    }
    try { localStorage.removeItem('hg_saved_' + u); } catch (e) {}
    if (Array.isArray(legacy)) { done.push(u); writeList(KEY_INIT, done); }
  }

  /* Lần đầu có dữ liệu Backend: gộp job_saves của sinh viên (lưu từ thiết bị khác) */
  function mergeBackendSaves() {
    var u = HG.user && HG.user();
    if (!u || u.role !== 'student' || !HG.apiLive || typeof job_saves === 'undefined') return;
    var done = readList(KEY_INIT);
    if (done.indexOf(u.id) !== -1) return;
    var sid = HG.studentId(u), all = readList(KEY_SAVED), mine = {}, added = 0;
    all.forEach(function (x) { if (x.uid === u.id) mine[x.id] = true; });
    job_saves.forEach(function (s) {
      if (s.student_id === sid && !mine[s.job_id]) { all.push(withSnapshot({ uid: u.id, id: s.job_id, saved_at: s.created_at || nowIso() })); added++; }
    });
    if (added) writeList(KEY_SAVED, all);
    done.push(u.id); writeList(KEY_INIT, done);
    if (added) { paint(); emit('saved', null, true); }
  }

  /* ───────────── Việc làm đã lưu ───────────── */
  function list() {
    var u = uid();
    migrateLegacy(u);
    return readList(KEY_SAVED).filter(function (x) { return x.uid === u; })
      .sort(function (a, b) { return String(b.saved_at || '').localeCompare(String(a.saved_at || '')); });
  }
  function ids() { return list().map(function (x) { return x.id; }); }
  function has(id) { id = Number(id); var u = uid(); return readList(KEY_SAVED).some(function (x) { return x.uid === u && x.id === id; }); }

  function add(id) {
    id = Number(id); if (!id) return false;
    var u = uid(), all = readList(KEY_SAVED);
    if (all.some(function (x) { return x.uid === u && x.id === id; })) return true;
    all.unshift(withSnapshot({ uid: u, id: id, saved_at: nowIso() }));
    if (!writeList(KEY_SAVED, all)) return false;
    emit('saved', id, true); paint();
    return true;
  }
  function remove(id) {
    id = Number(id);
    var u = uid(), all = readList(KEY_SAVED);
    var next = all.filter(function (x) { return !(x.uid === u && x.id === id); });
    if (next.length === all.length) return false;
    writeList(KEY_SAVED, next);
    emit('saved', id, false); paint();
    return true;
  }
  function toggle(id) { if (has(id)) { remove(id); return false; } return add(id); }
  function clear() {
    var u = uid(), removed = list().map(function (x) { return x.id; });
    writeList(KEY_SAVED, readList(KEY_SAVED).filter(function (x) { return x.uid !== u; }));
    emit('saved', null, false); paint();
    return removed;
  }

  /* ───────────── Đã xem gần đây (tối đa 10) ───────────── */
  function recent() {
    var u = uid();
    return readList(KEY_RECENT).filter(function (x) { return x.uid === u; })
      .sort(function (a, b) { return String(b.viewed_at || '').localeCompare(String(a.viewed_at || '')); })
      .slice(0, MAX_RECENT);
  }
  function addRecent(jobOrId) {
    var id = typeof jobOrId === 'object' && jobOrId ? Number(jobOrId.id) : Number(jobOrId);
    if (!id) return;
    var u = uid();
    var others = readList(KEY_RECENT).filter(function (x) { return x.uid !== u; });
    var mine = recent().filter(function (x) { return x.id !== id; });
    mine.unshift(withSnapshot({ uid: u, id: id, viewed_at: nowIso() }, jobOrId));
    writeList(KEY_RECENT, mine.slice(0, MAX_RECENT).concat(others));
    emit('recent', id, true);
  }
  function removeRecent(id) {
    id = Number(id); var u = uid();
    writeList(KEY_RECENT, readList(KEY_RECENT).filter(function (x) { return !(x.uid === u && x.id === id); }));
    emit('recent', id, false);
  }
  function clearRecent() {
    var u = uid();
    writeList(KEY_RECENT, readList(KEY_RECENT).filter(function (x) { return x.uid !== u; }));
    emit('recent', null, false);
  }

  /* ───────────── Đồng bộ trạng thái mọi nút lưu đang hiển thị ───────────── */
  function paint(root) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    root = root || document;
    var tr = function (k, fb) { return typeof window.t === 'function' ? window.t(k) : fb; };
    var saved = {}; ids().forEach(function (id) { saved[id] = true; });
    root.querySelectorAll('.job-card[data-id] .save-btn').forEach(function (b) {
      var on = !!saved[Number(b.closest('.job-card').dataset.id)];
      b.classList.toggle('saved', on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? tr('common.unsave_job', 'Bỏ lưu việc làm') : tr('common.save_job', 'Lưu việc làm'));
      b.title = on ? tr('common.unsave_short', 'Bỏ lưu tin') : tr('common.save_short', 'Lưu tin');
    });
    root.querySelectorAll('[data-rec-job], [data-save-job]').forEach(function (b) {
      var on = !!saved[Number(b.dataset.recJob || b.dataset.saveJob)];
      b.classList.toggle('saved', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  /* Thay lõi lưu việc cũ (hg_saved_<uid>) bằng kho mới – giữ nguyên chữ ký hàm */
  HG.getSaved = ids;
  HG.isSaved = has;
  HG.toggleSaved = toggle;

  HG.savedJobs = {
    KEY_SAVED: KEY_SAVED, KEY_RECENT: KEY_RECENT, MAX_RECENT: MAX_RECENT,
    list: list, ids: ids, has: has, add: add, remove: remove, toggle: toggle, clear: clear,
    recent: recent, addRecent: addRecent, removeRecent: removeRecent, clearRecent: clearRecent,
    paint: paint
  };

  if (typeof window.addEventListener === 'function') {
    /* Thay đổi ở tab khác của trình duyệt -> cập nhật tức thời */
    window.addEventListener('storage', function (e) {
      if (e.key === KEY_SAVED || e.key === KEY_RECENT) {
        paint();
        emit(e.key === KEY_SAVED ? 'saved' : 'recent', null, null);
      }
    });
    window.addEventListener('languageChanged', function () { paint(); });
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('hg:synced', function () { mergeBackendSaves(); paint(); });
    /* Thẻ việc làm được vẽ lại (home/jobs/related) -> đảm bảo trạng thái nút đúng */
    var schedule = null;
    if (typeof MutationObserver !== 'undefined' && document.body) {
      new MutationObserver(function () {
        if (schedule) return;
        schedule = setTimeout(function () { schedule = null; paint(); }, 30);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
})();
