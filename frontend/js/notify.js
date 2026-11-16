/* Chuông thông báo dùng chung (header công khai + dashboard): dữ liệu thật trong localStorage,
   cập nhật gần thời gian thực (sự kiện nội bộ + sự kiện storage giữa các tab + quét định kỳ). */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user();
  if (!me) return;
  HG.seedNotifs(me);

  var KIND_ICON = { app: 'file', job: 'briefcase', shift: 'calendar', role: 'shield', info: 'bell' };
  var mounts = [], lastUnread = null;

  function unreadCount() { return HG.notifs(me.id).filter(function (n) { return !n.read; }).length; }

  function listHtml() {
    var list = HG.notifs(me.id).slice(0, 12);
    if (!list.length) return '<div class="notify-empty">' + HG.icon('bell', 22) + '<strong>Chưa có thông báo nào</strong><small>Thông báo về hồ sơ, lịch làm việc và tin tuyển dụng sẽ hiện ở đây.</small></div>';
    return list.map(function (n) {
      return '<div class="notify-item' + (n.read ? '' : ' unread') + '" data-nid="' + HG.esc(n.id) + '" data-link="' + HG.esc(n.link || '') + '" role="button" tabindex="0">' +
        '<span class="notify-item-icon">' + HG.icon(KIND_ICON[n.kind] || 'bell', 16) + '</span>' +
        '<div class="notify-item-content"><strong>' + HG.esc(n.text) + '</strong><small>' + HG.timeAgo(n.ts) + '</small></div></div>';
    }).join('');
  }

  function paint(m) {
    var c = unreadCount();
    m.panel.innerHTML = '<div class="notify-popover-head"><strong>Thông báo' + (c ? ' (' + c + ')' : '') + '</strong>' +
      '<button type="button" data-readall' + (c ? '' : ' disabled') + '>Đọc tất cả</button></div><div class="notify-popover-list">' + listHtml() + '</div>';
    var badge = m.btn.querySelector('.notif-count');
    if (!badge) { badge = document.createElement('b'); badge.className = 'notif-count'; m.btn.appendChild(badge); }
    badge.textContent = c > 9 ? '9+' : c; badge.hidden = !c;
    var old = m.btn.querySelector('i, .badge-dot'); if (old) old.style.display = 'none';
  }

  function mount(btn, panel) {
    var fresh = btn.cloneNode(true); btn.parentNode.replaceChild(fresh, btn);   // gỡ listener cũ (dữ liệu giả)
    var m = { btn: fresh, panel: panel }; mounts.push(m);
    fresh.setAttribute('aria-haspopup', 'true');
    fresh.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.classList.toggle('show'); fresh.setAttribute('aria-expanded', open);
      if (open) paint(m);
    });
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('[data-readall]')) { HG.markNotifsRead(me.id); HG.toast('Đã đánh dấu tất cả là đã đọc.', 'info'); return; }
      var it = e.target.closest('[data-nid]'); if (!it) return;
      HG.markNotifsRead(me.id, it.dataset.nid);
      var link = it.dataset.link; if (link) location.href = link;
    });
    document.addEventListener('click', function () { panel.classList.remove('show'); });
    paint(m);
  }

  function refresh(fromOtherSource) {
    var c = unreadCount();
    if (fromOtherSource && lastUnread !== null && c > lastUnread) {
      var latest = HG.notifs(me.id).filter(function (n) { return !n.read; })[0];
      if (latest) HG.toast(latest.text, 'info');
    }
    lastUnread = c;
    mounts.forEach(paint);
  }

  /* Header công khai */
  var hb = document.getElementById('header-notify-btn'), hp = document.getElementById('header-notify-popover');
  if (hb && hp) mount(hb, hp);
  /* Dashboard */
  var db = document.querySelector('.dash-header .notify');
  if (db) {
    var old = document.getElementById('dash-notify-dropdown'); if (old) old.remove();
    var dp = document.createElement('div'); dp.className = 'dash-notify-dropdown'; dp.id = 'dash-notify-dropdown';
    document.querySelector('.dash-header').appendChild(dp);
    mount(db, dp);
  }
  if (!mounts.length) return;
  lastUnread = unreadCount();

  document.addEventListener('hg:notify', function () { refresh(false); });
  window.addEventListener('storage', function (e) { if (e.key === 'hg_notifs') refresh(true); });
  setInterval(function () { refresh(true); }, 6000);          // quét định kỳ: cập nhật "x phút trước" + thông báo mới
})();
