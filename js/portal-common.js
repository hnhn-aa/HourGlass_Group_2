/* Dùng chung cho Sinh viên & Nhà tuyển dụng: form khiếu nại, form đánh giá, nút "Báo cáo tin" ở trang chi tiết */
(function () {
  'use strict';
  var HG = window.HG, me = HG.user(), E = HG.esc;
  if (!me) return;

  var REASONS = {
    job: ['Thông tin tuyển dụng sai sự thật', 'Yêu cầu đóng phí / dấu hiệu lừa đảo', 'Nội dung vi phạm quy định', 'Khác'],
    employer: ['Không trả lương đúng hạn / đúng thỏa thuận', 'Thái độ, hành vi quấy rối không phù hợp', 'Điều kiện làm việc không như đã đăng', 'Khác'],
    student: ['Nghỉ ngang, không đến làm không báo trước', 'Thái độ, hành vi không phù hợp', 'Cung cấp thông tin hồ sơ sai sự thật', 'Khác']
  };

  /* type: job | employer | student ; targetId: id của tin / hồ sơ NTD / hồ sơ SV */
  HG.openReportForm = function (type, targetId, label) {
    if (me.role === 'admin') { HG.toast('Quản trị viên xử lý khiếu nại trong Trung tâm khiếu nại.', 'info'); return; }
    HG.formModal({
      title: 'Gửi khiếu nại', subtitle: 'Đối tượng: <strong>' + E(label) + '</strong>. Quản trị viên sẽ xem xét và phản hồi cho bạn.',
      fields: [
        { name: 'reason', label: 'Lý do khiếu nại', type: 'select', required: true, options: REASONS[type].map(function (r) { return [r, r]; }) },
        { name: 'detail', label: 'Mô tả chi tiết', type: 'textarea', rows: 5, required: true, placeholder: 'Nêu rõ sự việc, thời gian, bằng chứng (nếu có)…', hint: 'Ít nhất 15 ký tự, tối đa 600 ký tự.' }
      ],
      confirmText: 'Gửi khiếu nại', danger: true,
      onSubmit: function (v) { var r = HG.fileReport({ type: type, targetId: targetId, reason: v.reason, detail: v.detail }); if (r.error) return r; document.dispatchEvent(new CustomEvent('hg:social')); return { ok: true, message: 'Đã gửi khiếu nại. Chúng tôi sẽ phản hồi sớm nhất.' }; }
    });
  };

  HG.openReviewForm = function (t) {
    HG.formModal({
      title: 'Đánh giá ' + t.name, subtitle: 'Vị trí: <strong>' + E(t.job) + '</strong>',
      fields: [
        { name: 'rating', label: 'Mức độ hài lòng', type: 'stars', required: true },
        { name: 'comment', label: 'Nhận xét', type: 'textarea', rows: 4, required: true, placeholder: 'Chia sẻ trải nghiệm làm việc thực tế của bạn…', hint: 'Ít nhất 10 ký tự. Đánh giá được hiển thị công khai và có thể bị ẩn nếu vi phạm quy định.' }
      ],
      confirmText: 'Gửi đánh giá',
      onSubmit: function (v) { var r = HG.addReview({ to_uid: t.uid, job_id: t.job_id, rating: v.rating, comment: v.comment }); if (r.error) return r; document.dispatchEvent(new CustomEvent('hg:social')); return { ok: true, message: 'Cảm ơn bạn đã gửi đánh giá!' }; }
    });
  };

  /* Trang chi tiết việc làm: hiển thị đánh giá + xác minh + nút báo cáo */
  var detail = document.getElementById('detail-root') || document.querySelector('.detail-hero, .job-detail, main');
  if (/job-detail\.html/.test(location.pathname)) {
    var id = Number(new URLSearchParams(location.search).get('id')), job = jobs.filter(function (j) { return j.id === id; })[0], ep = job && HG.employerProfile(job.employer_id);
    var attach = function () {
      var host = document.querySelector('.detail-head'); if (!host || !ep || document.getElementById('detail-trust')) return;
      var r = HG.avgRating(ep.user_id), box = document.createElement('div'); box.id = 'detail-trust'; box.className = 'detail-trust';
      box.innerHTML = '<span>' + (ep.verified ? '<b class="verified-badge">✔ Đã xác minh</b>' : '<small class="unverified">Chưa xác minh</small>') + '</span>' +
        '<span class="star-line">' + (r.count ? HG.stars(r.avg) + '<small>' + r.avg.toFixed(1) + ' (' + r.count + ' đánh giá)</small>' : '<small>Chưa có đánh giá</small>') + '</span>' +
        (me.role === 'admin' || me.role === 'employer' && ep.user_id === me.id ? '' : '<button type="button" class="link-btn" id="detail-report">⚑ Báo cáo tin này</button>');
      host.insertAdjacentElement('beforeend', box);
      var b = document.getElementById('detail-report'); if (b) b.addEventListener('click', function () { HG.openReportForm('job', job.id, job.title); });
    };
    setTimeout(attach, 80);
  }
})();
