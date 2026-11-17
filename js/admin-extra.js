/* Admin: CRUD danh mục ngành nghề + phân quyền quản trị (Admin gốc cấp / thu hồi quyền cho tài khoản khác) */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user();
  if (!me || me.role !== 'admin') return;
  var E = HG.esc, I = HG.icon, $ = function (id) { return document.getElementById(id); };
  var isRoot = HG.isRootAdmin(me);

  /* ======================= DANH MỤC NGÀNH NGHỀ ======================= */
  var catRows = $('cat-rows'), catSearch = $('cat-search');
  function jobCount(id) { return jobs.filter(function (j) { return j.category_id === id; }).length; }

  function renderCats() {
    if (!catRows) return;
    var q = (catSearch ? catSearch.value : '').trim().toLowerCase();
    var list = job_categories.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1 || (c.description || '').toLowerCase().indexOf(q) !== -1; });
    if (!job_categories.length) { catRows.innerHTML = HG.empty('sparkle', 'Chưa có danh mục nào', 'Hãy thêm danh mục đầu tiên để phân loại tin tuyển dụng.', '<button type="button" class="primary-btn small" id="cat-add-empty">Thêm danh mục</button>'); return; }
    if (!list.length) { catRows.innerHTML = HG.empty('search', 'Không tìm thấy danh mục phù hợp', 'Thử từ khóa khác.'); return; }
    catRows.innerHTML = list.map(function (c) {
      var n = jobCount(c.id);
      return '<div class="table-row cat-grid"><span><b>' + E(c.name) + '</b><small>Mã #' + c.id + '</small></span><span>' + E(c.description || '—') + '</span>' +
        '<span><b>' + n + '</b> tin</span><span>' + HG.fmtDate((c.updated_at || c.created_at || '').slice(0, 10)) + '</span>' +
        '<span class="table-actions"><button type="button" class="cv-action-btn" data-cat-edit="' + c.id + '" title="Sửa">' + I('settings', 14) + ' Sửa</button>' +
        '<button type="button" class="cv-action-btn danger" data-cat-del="' + c.id + '" title="Xóa">' + I('trash', 14) + '</button></span></div>';
    }).join('');
  }

  function catForm(cat) {
    var editing = !!cat;
    HG.modal.open({
      className: 'modal-reason', dismissible: true, labelledBy: 'cat-title',
      html: '<h2 id="cat-title">' + (editing ? 'Sửa danh mục' : 'Thêm danh mục mới') + '</h2><form data-form novalidate>' +
        '<label>Tên danh mục <span class="req-star">*</span><input name="name" maxlength="40" value="' + E(editing ? cat.name : '') + '" placeholder="Ví dụ: Gia sư, Thiết kế…"></label>' +
        '<small class="field-err" data-e="name"></small>' +
        '<label style="margin-top:12px">Mô tả (không bắt buộc)<textarea name="desc" rows="3" maxlength="140" placeholder="Mô tả ngắn về nhóm công việc này">' + E(editing ? cat.description || '' : '') + '</textarea></label>' +
        '<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-cancel>Hủy</button>' +
        '<button type="submit" class="primary-btn">' + (editing ? 'Lưu thay đổi' : 'Thêm danh mục') + '</button></div></form>',
      onMount: function (api) {
        var f = api.box.querySelector('form'), en = api.box.querySelector('[data-e=name]');
        api.box.querySelector('[data-cancel]').addEventListener('click', function () { api.close(false); });
        f.name.focus();
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var name = f.name.value.trim().replace(/\s+/g, ' '), desc = f.desc.value.trim(), msg = '';
          if (!name) msg = 'Vui lòng nhập tên danh mục.';
          else if (name.length < 2) msg = 'Tên danh mục cần ít nhất 2 ký tự.';
          else if (job_categories.some(function (c) { return c.name.toLowerCase() === name.toLowerCase() && (!editing || c.id !== cat.id); })) msg = 'Danh mục "' + name + '" đã tồn tại.';
          en.textContent = msg; f.name.classList.toggle('invalid', !!msg);
          if (msg) { f.name.focus(); return; }
          HG.busy(f.querySelector('[type=submit]'), function () {
            var now = HG.now();
            if (editing) { cat.name = name; cat.description = desc; cat.updated_at = now; }
            else job_categories.push({ id: job_categories.reduce(function (m, c) { return Math.max(m, c.id); }, 0) + 1, name: name, description: desc, created_at: now, updated_at: now });
            HG.saveCategories(); api.close(true); renderCats();
            HG.toast(editing ? 'Đã cập nhật danh mục "' + name + '".' : 'Đã thêm danh mục "' + name + '".');
          }, 600);
        });
      }
    });
  }

  var addBtn = $('cat-add-btn'); if (addBtn) addBtn.addEventListener('click', function () { catForm(null); });
  if (catSearch) catSearch.addEventListener('input', renderCats);
  if (catRows) catRows.addEventListener('click', function (e) {
    if (e.target.closest('#cat-add-empty')) { catForm(null); return; }
    var ed = e.target.closest('[data-cat-edit]');
    if (ed) { catForm(job_categories.filter(function (c) { return c.id === +ed.dataset.catEdit; })[0]); return; }
    var del = e.target.closest('[data-cat-del]'); if (!del) return;
    var c = job_categories.filter(function (x) { return x.id === +del.dataset.catDel; })[0]; if (!c) return;
    var n = jobCount(c.id);
    if (n > 0) { HG.toast('Không thể xóa: đang có ' + n + ' tin dùng danh mục "' + c.name + '". Hãy chuyển các tin sang danh mục khác trước.', 'error'); return; }
    HG.confirm({ title: 'Xóa danh mục?', message: 'Danh mục "' + c.name + '" sẽ bị xóa khỏi hệ thống.', confirmText: 'Xóa danh mục', cancelText: 'Hủy', danger: true }).then(function (ok) {
      if (!ok) return;
      HG.busy(del, function () {
        job_categories.splice(job_categories.indexOf(c), 1); HG.saveCategories(); renderCats(); HG.toast('Đã xóa danh mục "' + c.name + '".');
      }, 600);
    });
  });
  renderCats();

  /* ======================= PHÂN QUYỀN QUẢN TRỊ ======================= */
  var roleRows = $('role-rows'), roleSearch = $('role-search'), roleTabs = $('role-filter-tabs'), banner = $('role-banner');
  var roleFilter = 'all';
  var ROLE_LABEL = { student: 'Sinh viên', employer: 'Nhà tuyển dụng', admin: 'Quản trị viên' };

  function renderBanner() {
    if (!banner) return;
    banner.innerHTML = isRoot
      ? '<div class="role-banner ok">' + I('shield', 18) + '<span><b>Bạn là Admin gốc.</b> Bạn có thể cấp quyền quản trị viên cho tài khoản khác và thu hồi khi cần. Quản trị viên được cấp quyền có thể kiểm duyệt tin, quản lý người dùng và danh mục, nhưng không thể thay đổi phân quyền.</span></div>'
      : '<div class="role-banner warn">' + I('alert', 18) + '<span><b>Chỉ Admin gốc mới được phân quyền.</b> Bạn đang đăng nhập với quyền quản trị viên thường nên chỉ có thể xem danh sách.</span></div>';
  }

  function renderRoles() {
    if (!roleRows) return;
    var q = (roleSearch ? roleSearch.value : '').trim().toLowerCase();
    var list = users.filter(function (u) {
      return (roleFilter === 'all' || u.role === roleFilter) && (!q || u.full_name.toLowerCase().indexOf(q) !== -1 || u.email.toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) { return (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) || a.id - b.id; });
    if (!list.length) { roleRows.innerHTML = HG.empty('users', 'Không tìm thấy tài khoản', 'Thử đổi bộ lọc hoặc từ khóa.'); return; }
    roleRows.innerHTML = list.map(function (u) {
      var root = u.id === HG.ROOT_ADMIN_ID, granted = u.role === 'admin' && !root;
      var by = granted && u.granted_by ? (users.filter(function (x) { return x.id === u.granted_by; })[0] || {}).full_name : '';
      var roleHtml = root ? '<span class="role-pill root">Admin gốc</span>' : u.role === 'admin' ? '<span class="role-pill admin">Quản trị viên</span>' + (by ? '<small>Cấp bởi ' + E(by) + '</small>' : '') : '<span class="role-pill">' + ROLE_LABEL[u.role] + '</span>';
      var act = '—';
      if (root) act = '<span style="color:#9aa2b2;font-size:12px">Không thể thay đổi</span>';
      else if (granted) act = '<button type="button" class="cv-action-btn danger" data-revoke="' + u.id + '"' + (isRoot ? '' : ' disabled title="Chỉ Admin gốc"') + '>Thu hồi quyền</button>';
      else if (u.status !== 'active') act = '<span style="color:#9aa2b2;font-size:12px">Tài khoản đang bị khóa</span>';
      else act = '<button type="button" class="cv-action-btn ok" data-grant="' + u.id + '"' + (isRoot ? '' : ' disabled title="Chỉ Admin gốc"') + '>' + I('shield', 14) + ' Cấp quyền QTV</button>';
      return '<div class="table-row role-grid"><span class="company-cell"><i class="company-logo" style="background:' + (u.role === 'admin' ? '#665CF6' : '#9aa6c8') + '">' + E(u.full_name.charAt(0)) + '</i><span><b>' + E(u.full_name) + '</b><small>Mã #' + u.id + '</small></span></span>' +
        '<span>' + E(u.email) + '</span><span class="role-cell">' + roleHtml + '</span>' +
        '<span><i class="' + (u.status === 'active' ? 'admin-badge-active' : 'admin-badge-locked') + '">' + (u.status === 'active' ? 'Hoạt động' : 'Đang khóa') + '</i></span>' +
        '<span class="table-actions">' + act + '</span></div>';
    }).join('');
  }

  if (roleRows) roleRows.addEventListener('click', function (e) {
    var g = e.target.closest('[data-grant]'), r = e.target.closest('[data-revoke]'), btn = g || r;
    if (!btn) return;
    if (!HG.isRootAdmin()) { HG.toast('Chỉ Admin gốc mới được thay đổi phân quyền.', 'error'); return; }
    var uid = +(btn.dataset.grant || btn.dataset.revoke), u = users.filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    var grant = !!g;
    HG.confirm({
      title: grant ? 'Cấp quyền quản trị viên?' : 'Thu hồi quyền quản trị?',
      message: grant ? '"' + u.full_name + '" (' + ROLE_LABEL[u.role] + ') sẽ có quyền kiểm duyệt tin, quản lý người dùng và danh mục. Tài khoản sẽ chuyển sang không gian Quản trị.' : '"' + u.full_name + '" sẽ mất quyền quản trị và quay lại vai trò ' + ROLE_LABEL[u.orig_role || 'student'] + '.',
      confirmText: grant ? 'Cấp quyền' : 'Thu hồi', cancelText: 'Hủy', danger: !grant, icon: 'shield'
    }).then(function (ok) {
      if (!ok) return;
      HG.busy(btn, function () {
        if (!HG.setRole(uid, grant ? 'admin' : 'student')) { HG.toast('Không thể thay đổi quyền của tài khoản này.', 'error'); return; }
        HG.notify(uid, grant ? 'Bạn đã được Admin gốc cấp quyền quản trị viên. Hãy đăng nhập lại để vào không gian quản trị.' : 'Quyền quản trị viên của bạn đã bị thu hồi.', { link: grant ? 'admin.html' : '', kind: 'role' });
        renderRoles(); HG.toast(grant ? 'Đã cấp quyền quản trị cho ' + u.full_name + '.' : 'Đã thu hồi quyền quản trị của ' + u.full_name + '.');
      }, 700);
    });
  });
  if (roleSearch) roleSearch.addEventListener('input', renderRoles);
  if (roleTabs) roleTabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-role-filter]'); if (!b) return;
    roleTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); }); b.classList.add('active'); roleFilter = b.dataset.roleFilter; renderRoles();
  });
  renderBanner(); renderRoles();
})();
