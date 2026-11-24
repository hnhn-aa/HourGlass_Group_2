/* Sinh viên – Kinh nghiệm làm việc (thêm / xóa, đồng bộ hồ sơ) */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), list = document.getElementById('student-exp-list');
  if (!list || !me || me.role !== 'student') return;
  function tr(k, fb, p) { return typeof window.t === 'function' ? window.t(k, p) : fb; }
  /* Kinh nghiệm chưa có bảng trên Backend -> lưu tại trình duyệt, tách riêng theo từng sinh viên.
     Tài khoản chưa có hồ sơ sinh viên dùng khóa theo user id (không dùng chung khóa của sinh viên #1). */
  var sidNow = HG.studentId(me);
  var E = HG.esc, key = sidNow ? 'hg_exp_' + sidNow : 'hg_exp_u' + me.id;
  var MAX_ITEMS = 10;
  var items = HG.read(key, []);   /* không sinh sẵn mục kinh nghiệm mẫu */
  if (!Array.isArray(items)) items = [];
  items = items.filter(function (x) { return x && x.id && x.title; });
  var $ = function (id) { return document.getElementById(id); };
  var inTitle = $('exp-title'), inCompany = $('exp-company'), inPeriod = $('exp-period'), addBtn = $('exp-add-btn'), err = $('exp-err');
  if (!inTitle || !inCompany || !inPeriod || !addBtn) return;

  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function sameKey(x) { return (clean(x.title) + '|' + clean(x.company)).toLocaleLowerCase('vi'); }

  /* flashId: thẻ cần nháy sáng; flashClass: 'is-new' (vừa thêm) | 'is-dup' (bị nhập trùng) – giống mục Kỹ năng */
  function render(flashId, flashClass) {
    var delTitle = tr('stu.exp_del_title', 'Xóa kinh nghiệm');
    list.innerHTML = items.length ? items.map(function (x) {
      return '<div class="exp-item' + (x.id === flashId ? ' ' + flashClass : '') + '"><div><b>' + E(x.title) + '</b><small>' + E(x.company) + (x.period ? ' · ' + E(x.period) : '') + '</small></div>' +
        '<button type="button" class="exp-del" data-del="' + x.id + '" title="' + E(delTitle) + '" aria-label="' + E(delTitle + ' ' + x.title) + '">&times;</button></div>';
    }).join('') : '<p class="exp-none" data-i18n="stu.exp_empty">' + E(tr('stu.exp_empty', 'Chưa có kinh nghiệm nào. Hãy thêm các công việc, dự án hoặc hoạt động bạn đã tham gia.')) + '</p>';
  }
  function showError(msg, field) {
    err.textContent = msg;
    [inTitle, inCompany, inPeriod].forEach(function (i) { i.classList.toggle('invalid', i === field); });
    if (field) field.focus();
    HG.toast(msg, 'error');
  }
  function clearError() {
    err.textContent = '';
    [inTitle, inCompany, inPeriod].forEach(function (i) { i.classList.remove('invalid'); });
  }

  function addExperience() {
    if (addBtn.dataset.busy) return;
    var t = clean(inTitle.value), c = clean(inCompany.value), p = clean(inPeriod.value);
    if (!t) return showError(tr('stu.exp_err_title', 'Vui lòng nhập vị trí.'), inTitle);
    if (!c) return showError(tr('stu.exp_err_company', 'Vui lòng nhập nơi làm việc.'), inCompany);
    if (items.length >= MAX_ITEMS) return showError(tr('stu.exp_err_max', 'Tối đa ' + MAX_ITEMS + ' mục kinh nghiệm.', { max: MAX_ITEMS }), null);
    var entry = { id: Date.now(), title: t, company: c, period: p };
    var dup = items.filter(function (x) { return sameKey(x) === sameKey(entry); })[0];
    if (dup) {
      render(dup.id, 'is-dup');   // nháy sáng mục đã có, giữ nguyên nội dung ô nhập để sửa
      HG.toast(tr('stu.exp_dup_toast', 'Kinh nghiệm "' + dup.title + ' – ' + dup.company + '" đã có trong danh sách.', { title: dup.title, company: dup.company }), 'info');
      return;
    }
    clearError();
    HG.busy(addBtn, function () {
      items.push(entry); HG.write(key, items); render(entry.id, 'is-new');
      inTitle.value = inCompany.value = inPeriod.value = '';
      inTitle.focus();
      HG.toast(tr('stu.exp_added_toast', 'Đã thêm kinh nghiệm "' + t + '".', { title: t }));
    }, 400);
  }

  addBtn.addEventListener('click', addExperience);
  /* Enter: chuyển sang ô kế tiếp; ở ô cuối thì thêm – KHÔNG gửi form "Lưu thông tin hồ sơ" */
  [inTitle, inCompany, inPeriod].forEach(function (input, idx, all) {
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (idx < all.length - 1 && !clean(all[idx + 1].value) && clean(input.value)) all[idx + 1].focus();
      else addExperience();
    });
    input.addEventListener('input', function () {
      if (input.classList.contains('invalid') && clean(input.value)) { input.classList.remove('invalid'); err.textContent = ''; }
    });
  });

  list.addEventListener('click', function (e) {
    var d = e.target.closest('[data-del]'); if (!d) return;
    var removed = items.filter(function (x) { return x.id === +d.dataset.del; })[0];
    items = items.filter(function (x) { return x.id !== +d.dataset.del; }); HG.write(key, items); render();
    HG.toast(removed ? tr('stu.exp_removed_toast', 'Đã xóa kinh nghiệm "' + removed.title + '".', { title: removed.title }) : 'OK', 'info');
  });
  document.addEventListener('hg:synced', function () { render(); });
  window.addEventListener('languageChanged', function () { clearError(); render(); });
  render();
})();
