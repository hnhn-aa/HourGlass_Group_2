/* Sinh viên – Kinh nghiệm làm việc (thêm / xóa, đồng bộ hồ sơ) */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), list = document.getElementById('student-exp-list');
  if (!list || !me || me.role !== 'student') return;
  var E = HG.esc, key = 'hg_exp_' + (HG.studentId(me) || 1);
  var items = HG.read(key, [{ id: 1, title: 'Cộng tác viên sự kiện', company: 'CLB Truyền thông trường', period: '09/2025 – 12/2025' }]);
  var $ = function (id) { return document.getElementById(id); };
  function render() {
    list.innerHTML = items.length ? items.map(function (x) {
      return '<div class="exp-item"><div><b>' + E(x.title) + '</b><small>' + E(x.company) + (x.period ? ' · ' + E(x.period) : '') + '</small></div>' +
        '<button type="button" class="exp-del" data-del="' + x.id + '" aria-label="Xóa kinh nghiệm">&times;</button></div>';
    }).join('') : '<p class="exp-none">Chưa có kinh nghiệm nào. Hãy thêm các công việc, dự án hoặc hoạt động bạn đã tham gia.</p>';
  }
  $('exp-add-btn').addEventListener('click', function () {
    var t = $('exp-title').value.trim(), c = $('exp-company').value.trim(), p = $('exp-period').value.trim(), err = $('exp-err');
    err.textContent = !t ? 'Vui lòng nhập vị trí.' : !c ? 'Vui lòng nhập nơi làm việc.' : items.length >= 10 ? 'Tối đa 10 mục kinh nghiệm.' : '';
    if (err.textContent) { HG.toast(err.textContent, 'error'); return; }
    HG.busy($('exp-add-btn'), function () {
      items.push({ id: Date.now(), title: t, company: c, period: p }); HG.write(key, items); render();
      $('exp-title').value = $('exp-company').value = $('exp-period').value = ''; HG.toast('Đã thêm kinh nghiệm "' + t + '".');
    }, 400);
  });
  list.addEventListener('click', function (e) {
    var d = e.target.closest('[data-del]'); if (!d) return;
    items = items.filter(function (x) { return x.id !== +d.dataset.del; }); HG.write(key, items); render(); HG.toast('Đã xóa kinh nghiệm.', 'info');
  });
  document.addEventListener('hg:synced', render);
  render();
})();
