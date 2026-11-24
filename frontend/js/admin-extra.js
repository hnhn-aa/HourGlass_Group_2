/* Admin: CRUD danh mục ngành nghề + phân quyền quản trị (đồng bộ trực tiếp với Backend API) */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user();
  if (!me || me.role !== 'admin') return;
  var E = HG.esc, I = HG.icon, $ = function (id) { return document.getElementById(id); };
  function tr(k, fb, p) { return window.t ? window.t(k, p) : (fb || k); }
  /* Báo cho dashboard.js vẽ lại KPI / biểu đồ / bảng sau khi thao tác ở đây (không cần F5) */
  function announce(kind) { document.dispatchEvent(new CustomEvent('hg:admin-changed', { detail: { kind: kind, source: 'extra' } })); }
  var isRoot = HG.isRootAdmin(me);

  /* ======================= DANH MỤC NGÀNH NGHỀ ======================= */
  var catRows = $('cat-rows'), catSearch = $('cat-search');
  function jobCount(id) { return jobs.filter(function (j) { return j.category_id === id; }).length; }

  function renderCats() {
    if (!catRows) return;
    var gq = (HG.getGlobalSearchQuery ? HG.getGlobalSearchQuery() : '');
    if (catSearch && gq !== undefined && document.activeElement !== catSearch) {
      catSearch.value = gq;
    }
    var q = (gq || (catSearch ? catSearch.value : '')).trim();
    var match = HG.matchText || function (s, query) { return String(s || '').toLowerCase().indexOf(String(query || '').toLowerCase()) !== -1; };
    var list = job_categories.filter(function (c) {
      if (!q) return true;
      return match(c.name, q) || match(c.description || '', q);
    });
    if (!job_categories.length) { catRows.innerHTML = HG.empty('sparkle', tr('adm.cat_empty_title', 'Chưa có danh mục nào'), tr('adm.cat_empty_desc', 'Hãy thêm danh mục đầu tiên để phân loại tin tuyển dụng.'), '<button type="button" class="primary-btn small" id="cat-add-empty">' + E(tr('adm.btn_add_cat', 'Thêm danh mục')) + '</button>'); return; }
    if (!list.length) {
      catRows.innerHTML = HG.empty('search', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), tr('adm.cat_search_empty_desc', 'Không có danh mục nào khớp với từ khóa "' + q + '".', { q: q }));
      return;
    }
    catRows.innerHTML = list.map(function (c) {
      var n = jobCount(c.id);
      return '<div class="table-row cat-grid"><span><b>' + E(c.name) + '</b><small>' + E(tr('adm.code_id', 'Mã #' + c.id, { id: c.id })) + '</small></span><span>' + E(c.description || '—') + '</span>' +
        '<span>' + E(tr('adm.jobs_unit', n + ' tin', { n: n })) + '</span><span>' + HG.fmtDate((c.updated_at || c.created_at || '').slice(0, 10)) + '</span>' +
        '<span class="table-actions"><button type="button" class="cv-action-btn" data-cat-edit="' + c.id + '" title="' + E(tr('adm.btn_edit', 'Sửa')) + '">' + I('settings', 14) + ' ' + E(tr('adm.btn_edit', 'Sửa')) + '</button>' +
        '<button type="button" class="cv-action-btn danger" data-cat-del="' + c.id + '" title="' + E(tr('adm.btn_delete', 'Xóa')) + '">' + I('trash', 14) + '</button></span></div>';
    }).join('');
  }

  function catForm(cat) {
    var editing = !!cat;
    HG.modal.open({
      className: 'modal-reason', dismissible: true, labelledBy: 'cat-title',
      html: '<h2 id="cat-title">' + E(editing ? tr('adm.cat_modal_edit', 'Sửa danh mục') : tr('adm.cat_modal_add', 'Thêm danh mục mới')) + '</h2><form data-form novalidate>' +
        '<label>' + E(tr('adm.cat_name_lbl', 'Tên danh mục')) + ' <span class="req-star">*</span><input name="name" maxlength="40" value="' + E(editing ? cat.name : '') + '" placeholder="' + E(tr('adm.cat_name_ph', 'Ví dụ: Gia sư, Thiết kế…')) + '"></label>' +
        '<small class="field-err" data-e="name"></small>' +
        '<label style="margin-top:12px">' + E(tr('adm.cat_desc_lbl', 'Mô tả (không bắt buộc)')) + '<textarea name="desc" rows="3" maxlength="140" placeholder="' + E(tr('adm.cat_desc_ph', 'Mô tả ngắn về nhóm công việc này')) + '">' + E(editing ? cat.description || '' : '') + '</textarea></label>' +
        '<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-cancel>' + E(tr('common.cancel', 'Hủy')) + '</button>' +
        '<button type="submit" class="primary-btn">' + E(editing ? tr('adm.btn_save_changes', 'Lưu thay đổi') : tr('adm.btn_add_cat', 'Thêm danh mục')) + '</button></div></form>',
      onMount: function (api) {
        var f = api.box.querySelector('form'), en = api.box.querySelector('[data-e=name]');
        api.box.querySelector('[data-cancel]').addEventListener('click', function () { api.close(false); });
        f.name.focus();
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var name = f.name.value.trim().replace(/\s+/g, ' '), desc = f.desc.value.trim(), msg = '';
          if (!name) msg = tr('adm.cat_err_req', 'Vui lòng nhập tên danh mục.');
          else if (name.length < 2) msg = tr('adm.cat_err_min', 'Tên danh mục cần ít nhất 2 ký tự.');
          else if (job_categories.some(function (c) { return c.name.toLowerCase() === name.toLowerCase() && (!editing || c.id !== cat.id); })) msg = tr('adm.cat_err_dup', 'Danh mục "' + name + '" đã tồn tại.', { name: name });
          en.textContent = msg; f.name.classList.toggle('invalid', !!msg);
          if (msg) { f.name.focus(); return; }
          HG.busy(f.querySelector('[type=submit]'), function () {
            var now = HG.now();
            if (editing) {
              cat.name = name; cat.description = desc; cat.updated_at = now;
              if (window.HGApi) HG.remote(window.HGApi.updateCategory(cat.id, name, desc));
            } else {
              var newCat = { id: job_categories.reduce(function (m, c) { return Math.max(m, c.id); }, 0) + 1, name: name, description: desc, created_at: now, updated_at: now };
              job_categories.push(newCat);
              if (window.HGApi) HG.remote(window.HGApi.createCategory(name, desc));
            }
            if (!HG.apiLive) HG.saveCategories();
            api.close(true); renderCats(); announce('category');
            HG.toast(editing ? tr('adm.toast_cat_updated', 'Đã cập nhật danh mục "' + name + '".', { name: name }) : tr('adm.toast_cat_added', 'Đã thêm danh mục "' + name + '".', { name: name }));
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
    if (n > 0) { HG.toast(tr('adm.toast_cat_del_in_use', 'Không thể xóa: đang có ' + n + ' tin dùng danh mục "' + c.name + '". Hãy chuyển các tin sang danh mục khác trước.', { n: n, name: c.name }), 'error'); return; }
    HG.confirm({ title: tr('adm.confirm_del_cat_title', 'Xóa danh mục?'), message: tr('adm.confirm_del_cat_msg', 'Danh mục "' + c.name + '" sẽ bị xóa khỏi hệ thống.', { name: c.name }), confirmText: tr('adm.confirm_del_cat_btn', 'Xóa danh mục'), cancelText: tr('common.cancel', 'Hủy'), danger: true }).then(function (ok) {
      if (!ok) return;
      HG.busy(del, function () {
        var delId = c.id;
        job_categories.splice(job_categories.indexOf(c), 1);
        if (!HG.apiLive) HG.saveCategories();
        if (window.HGApi) HG.remote(window.HGApi.deleteCategory(delId));
        renderCats(); announce('category');
        HG.toast(tr('adm.toast_cat_deleted', 'Đã xóa danh mục "' + c.name + '".', { name: c.name }));
      }, 600);
    });
  });
  renderCats();

  /* ======================= PHÂN QUYỀN QUẢN TRỊ ======================= */
  var roleRows = $('role-rows'), roleSearch = $('role-search'), roleTabs = $('role-filter-tabs'), banner = $('role-banner');
  var roleFilter = 'all';
  function roleLabel(role) {
    var map = {
      student: tr('adm.rf_student', 'Sinh viên'),
      employer: tr('adm.rf_employer', 'Nhà tuyển dụng'),
      admin: tr('adm.rf_admin', 'Quản trị viên')
    };
    return map[role] || role;
  }

  function renderBanner() {
    if (!banner) return;
    banner.innerHTML = isRoot
      ? '<div class="role-banner ok">' + I('shield', 18) + '<span>' + tr('adm.banner_root_html', '<b>Bạn là Admin gốc.</b> Bạn có thể cấp quyền quản trị viên cho tài khoản khác và thu hồi khi cần. Quản trị viên được cấp quyền có thể kiểm duyệt tin, quản lý người dùng và danh mục, nhưng không thể thay đổi phân quyền.') + '</span></div>'
      : '<div class="role-banner warn">' + I('alert', 18) + '<span>' + tr('adm.banner_normal_html', '<b>Chỉ Admin gốc mới được phân quyền.</b> Bạn đang đăng nhập với quyền quản trị viên thường nên chỉ có thể xem danh sách.') + '</span></div>';
  }

  function renderRoles() {
    if (!roleRows) return;
    var gq = (HG.getGlobalSearchQuery ? HG.getGlobalSearchQuery() : '');
    if (roleSearch && gq !== undefined && document.activeElement !== roleSearch) {
      roleSearch.value = gq;
    }
    var q = (gq || (roleSearch ? roleSearch.value : '')).trim();
    var match = HG.matchText || function (s, query) { return String(s || '').toLowerCase().indexOf(String(query || '').toLowerCase()) !== -1; };
    var list = users.filter(function (u) {
      var matchRole = roleFilter === 'all' || u.role === roleFilter;
      if (!matchRole) return false;
      if (!q) return true;
      return match(u.full_name, q) ||
        match(u.email, q) ||
        match(roleLabel(u.role) || '', q) ||
        (u.id === HG.ROOT_ADMIN_ID && match('Admin goc', q));
    }).sort(function (a, b) { return (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1) || a.id - b.id; });
    if (!list.length) {
      roleRows.innerHTML = HG.empty('users', tr('stu.search_no_match_title', 'Không tìm thấy kết quả phù hợp với từ khóa'), tr('adm.role_search_empty_desc', 'Không có tài khoản nào khớp với từ khóa "' + q + '".', { q: q }));
      return;
    }
    roleRows.innerHTML = list.map(function (u) {
      var root = u.id === HG.ROOT_ADMIN_ID, granted = u.role === 'admin' && !root;
      var by = granted && u.granted_by ? (users.filter(function (x) { return x.id === u.granted_by; })[0] || {}).full_name : '';
      var roleHtml = root ? '<span class="role-pill root">' + E(tr('adm.role_root_pill', 'Admin gốc')) + '</span>' : u.role === 'admin' ? '<span class="role-pill admin">' + E(tr('adm.role_admin_pill', 'Quản trị viên')) + '</span>' + (by ? '<small>' + E(tr('adm.granted_by', 'Cấp bởi ' + by, { name: by })) + '</small>' : '') : '<span class="role-pill">' + E(roleLabel(u.role)) + '</span>';
      var act = '—';
      if (root) act = '<span style="color:#9aa2b2;font-size:12px">' + E(tr('adm.cannot_change', 'Không thể thay đổi')) + '</span>';
      else if (granted) act = '<button type="button" class="cv-action-btn danger" data-revoke="' + u.id + '"' + (isRoot ? '' : ' disabled title="' + E(tr('adm.only_root_title', 'Chỉ Admin gốc')) + '"') + '>' + E(tr('adm.btn_revoke', 'Thu hồi quyền')) + '</button>';
      else if (u.status !== 'active') act = '<span style="color:#9aa2b2;font-size:12px">' + E(tr('adm.acc_locked_note', 'Tài khoản đang bị khóa')) + '</span>';
      else act = '<button type="button" class="cv-action-btn ok" data-grant="' + u.id + '"' + (isRoot ? '' : ' disabled title="' + E(tr('adm.only_root_title', 'Chỉ Admin gốc')) + '"') + '>' + I('shield', 14) + ' ' + E(tr('adm.btn_grant', 'Cấp quyền QTV')) + '</button>';
      var sp = u.role === 'student' && student_profiles.filter(function (x) { return x.user_id === u.id; })[0];
      var ep = (u.role === 'employer' || u.role === 'recruiter') && employer_profiles.filter(function (x) { return x.user_id === u.id; })[0];
      return '<div class="table-row role-grid"><span class="company-cell">' + HG.avatar(u.full_name, sp ? sp.avatar_url : ep ? ep.logo_url : '', { tag: 'i', className: 'company-logo' }) + '<span><b>' + E(u.full_name) + '</b><small>' + E(tr('adm.code_id', 'Mã #' + u.id, { id: u.id })) + '</small></span></span>' +
        '<span>' + E(u.email) + '</span><span class="role-cell">' + roleHtml + '</span>' +
        '<span><i class="' + (u.status === 'active' ? 'admin-badge-active' : 'admin-badge-locked') + '">' + E(u.status === 'active' ? tr('adm.st_active', 'Hoạt động') : tr('adm.st_locked', 'Đang khóa')) + '</i></span>' +
        '<span class="table-actions">' + act + '</span></div>';
    }).join('');
  }

  if (roleRows) roleRows.addEventListener('click', function (e) {
    var g = e.target.closest('[data-grant]'), r = e.target.closest('[data-revoke]'), btn = g || r;
    if (!btn) return;
    if (!HG.isRootAdmin()) { HG.toast(tr('adm.toast_only_root', 'Chỉ Admin gốc mới được thay đổi phân quyền.'), 'error'); return; }
    var uid = +(btn.dataset.grant || btn.dataset.revoke), u = users.filter(function (x) { return x.id === uid; })[0]; if (!u) return;
    var grant = !!g;
    var curRoleLbl = roleLabel(u.role), origRoleLbl = roleLabel(u.orig_role || 'student');
    HG.confirm({
      title: grant ? tr('adm.confirm_grant_title', 'Cấp quyền quản trị viên?') : tr('adm.confirm_revoke_title', 'Thu hồi quyền quản trị?'),
      message: grant ? tr('adm.confirm_grant_msg', '"' + u.full_name + '" (' + curRoleLbl + ') sẽ có quyền kiểm duyệt tin, quản lý người dùng và danh mục. Tài khoản sẽ chuyển sang không gian Quản trị.', { name: u.full_name, role: curRoleLbl }) : tr('adm.confirm_revoke_msg', '"' + u.full_name + '" sẽ mất quyền quản trị và quay lại vai trò ' + origRoleLbl + '.', { name: u.full_name, role: origRoleLbl }),
      confirmText: grant ? tr('adm.confirm_grant_btn', 'Cấp quyền') : tr('adm.confirm_revoke_btn', 'Thu hồi'), cancelText: tr('common.cancel', 'Hủy'), danger: !grant, icon: 'shield'
    }).then(function (ok) {
      if (!ok) return;
      HG.busy(btn, function () {
        if (!HG.setRole(uid, grant ? 'admin' : 'student')) { HG.toast(tr('adm.toast_role_err', 'Không thể thay đổi quyền của tài khoản này.'), 'error'); return; }
        HG.notify(uid, grant ? 'Bạn đã được Admin gốc cấp quyền quản trị viên. Hãy đăng nhập lại để vào không gian quản trị.' : 'Quyền quản trị viên của bạn đã bị thu hồi.', { link: grant ? 'admin.html' : '', kind: 'role' });
        renderRoles(); announce('role'); HG.toast(grant ? tr('adm.toast_role_granted', 'Đã cấp quyền quản trị cho ' + u.full_name + '.', { name: u.full_name }) : tr('adm.toast_role_revoked', 'Đã thu hồi quyền quản trị của ' + u.full_name + '.', { name: u.full_name }));
      }, 700);
    });
  });
  if (roleSearch) roleSearch.addEventListener('input', renderRoles);
  if (roleTabs) roleTabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-role-filter]'); if (!b) return;
    roleTabs.querySelectorAll('.dash-pill').forEach(function (p) { p.classList.remove('active'); }); b.classList.add('active'); roleFilter = b.dataset.roleFilter; renderRoles();
  });

  document.addEventListener('hg:synced', function () {
    renderCats();
    renderRoles();
  });
  window.addEventListener('languageChanged', function () {
    renderCats();
    renderBanner();
    renderRoles();
  });
  /* Khóa / mở khóa tài khoản ở tab Sinh viên / NTD -> cột trạng thái ở bảng Phân quyền cập nhật ngay */
  document.addEventListener('hg:admin-changed', function (e) { if (e.detail && e.detail.source !== 'extra') renderRoles(); });

  if (HG.onGlobalSearch) {
    HG.onGlobalSearch(function () {
      renderCats();
      renderRoles();
    });
  }

  /* Tiêu đề đầu trang luôn hiển thị đủ dưới header cố định (mọi tab Admin):
     - showTab() chỉ ẩn/hiện view nên trình duyệt giữ vị trí cuộn của tab trước → tab mới mở ra ở giữa nội dung.
     - html { scroll-behavior: smooth } khiến scrollTo() cuộn từ từ → phải tạm tắt để về đầu NGAY LẬP TỨC.
     - F5: trình duyệt tự khôi phục vị trí cuộn cũ trong khi tab hiển thị đã khác → tắt khôi phục tự động. */
  function scrollToTopInstant() {
    var html = document.documentElement, se = document.scrollingElement || html;
    if (se.scrollTop <= 0) return;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });   // 'instant' ghi đè scroll-behavior: smooth của CSS
    } catch (e) { /* trình duyệt cũ không nhận object options */ }
    if (se.scrollTop > 0) {
      var prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      void html.offsetHeight;          // buộc trình duyệt áp dụng style mới trước khi cuộn
      se.scrollTop = 0;
      html.style.scrollBehavior = prev;
    }
  }
  document.addEventListener('click', function (e) {
    // chạy sau handler chuyển tab của dashboard.js (gắn trước, ở chính nút / document)
    if (e.target.closest('.dash-sidebar nav [data-tab], [data-goto-tab]')) scrollToTopInstant();
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollToTopInstant();

  renderBanner(); renderRoles();
})();
