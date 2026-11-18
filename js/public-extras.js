/* Trang công khai: số liệu thật, form liên hệ, đăng ký bản tin, nút liên hệ hỗ trợ */
(function () {
  'use strict';
  var HG = window.HG;

  /* ---- Số liệu thật ở trang chủ (thay số cố định) ---- */
  if (/(^|\/)(index\.html)?$/.test(location.pathname)) {
    var active = users.filter(function (u) { return u.status === 'active'; }), n = {
      '12.000+': active.filter(function (u) { return u.role === 'student'; }).length, '12K sinh viên': active.filter(function (u) { return u.role === 'student'; }).length + ' sinh viên',
      '850+': active.filter(function (u) { return u.role === 'employer'; }).length, '1.240+': jobs.filter(function (j) { return j.status === 'approved'; }).length
    };
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), node;
    while ((node = w.nextNode())) { var t = node.nodeValue.trim(); if (n.hasOwnProperty(t)) node.nodeValue = String(n[t]); }
  }

  /* ---- Form liên hệ (trang Giới thiệu) ---- */
  var cf = document.querySelector('#contact form');
  if (cf) {
    cf.removeAttribute('onsubmit');
    cf.addEventListener('submit', function (e) {
      e.preventDefault();
      var ins = cf.querySelectorAll('input, textarea'), btn = cf.querySelector('[type=submit]');
      HG.busy(btn, function () {
        var r = HG.addContact({ name: ins[0].value, email: ins[1].value, message: ins[2].value });
        if (r.error) { HG.toast(r.error, 'error'); return; }
        cf.reset(); HG.toast('Đã gửi tin nhắn! Đội ngũ HourGlass sẽ phản hồi trong vòng 24 giờ.');
      }, 700);
    });
  }

  /* ---- Đăng ký bản tin ở footer ---- */
  var nl = document.querySelector('.newsletter label');
  if (nl) {
    var nin = nl.querySelector('input'), nbtn = nl.querySelector('button'); nbtn.type = 'button'; nin.type = 'email';
    var go = function () { HG.busy(nbtn, function () { var r = HG.subscribe(nin.value); if (r.error) { HG.toast(r.error, 'error'); return; } nin.value = ''; HG.toast('Đã đăng ký nhận việc làm qua email. Cảm ơn bạn!'); }, 600); };
    nbtn.addEventListener('click', go); nin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }

  /* ---- "Liên hệ hỗ trợ" trong dashboard: gửi thẳng cho admin ---- */
  HG.openSupport = function () {
    var u = HG.user();
    HG.formModal({ title: 'Liên hệ hỗ trợ', subtitle: 'Tin nhắn sẽ được gửi tới đội ngũ quản trị HourGlass.',
      fields: [{ name: 'message', label: 'Bạn cần hỗ trợ gì?', type: 'textarea', rows: 5, required: true, placeholder: 'Mô tả vấn đề của bạn…' }], confirmText: 'Gửi tin nhắn',
      onSubmit: function (v) { var r = HG.addContact({ name: u ? u.full_name : '', email: u ? u.email : '', message: v.message, subject: 'Hỗ trợ từ không gian cá nhân' }); return r.error ? r : { ok: true, message: 'Đã gửi tới đội ngũ hỗ trợ. Chúng tôi sẽ phản hồi trong thông báo của bạn.' }; } });
  };
  document.querySelectorAll('.dash-sidebar button[onclick*="about.html#contact"], aside button[onclick*="about.html#contact"]').forEach(function (b) {
    b.removeAttribute('onclick'); b.addEventListener('click', function () { HG.openSupport(); });
  });
})();
