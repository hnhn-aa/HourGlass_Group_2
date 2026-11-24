/* =========================================================
   responsive.js – Hỗ trợ hiển thị trên điện thoại / máy tính bảng
   1. Bảng quản lý dạng lưới (.manage-table > .table-head + .table-row):
      tự gắn data-label = tên cột cho từng ô, để ở ≤768px CSS (responsive.css)
      chuyển mỗi hàng thành một thẻ (card) có nhãn rõ ràng thay vì tràn ngang.
      Các hàng do JS vẽ lại (lọc, tìm kiếm, đồng bộ API) được gắn nhãn tự động.
   2. Mọi thẻ <table> được bọc trong .table-scroll (overflow-x: auto).
   Nạp được ở mọi trang, không phụ thuộc file JS khác.
   ========================================================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  var mq = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
  function isMobile() { return mq ? mq.matches : window.innerWidth <= 768; }

  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  /* Hàng tiêu đề tương ứng: cùng lớp lưới (cat-grid / role-grid...) nếu có */
  function headFor(table, row) {
    var heads = table.querySelectorAll('.table-head');
    if (!heads.length) return null;
    for (var i = 0; i < heads.length; i++) {
      var extra = heads[i].className.replace('table-head', '').trim();
      if (extra && row.classList.contains(extra.split(/\s+/)[0])) return heads[i];
    }
    return heads[0];
  }

  function labelTable(table) {
    table.classList.add('rwd-table');
    table.querySelectorAll('.table-row').forEach(function (row) {
      var head = headFor(table, row); if (!head) return;
      var labels = Array.prototype.map.call(head.children, text);
      Array.prototype.forEach.call(row.children, function (cell, i) {
        var lb = labels[i] || '';
        if (cell.getAttribute('data-label') !== lb) cell.setAttribute('data-label', lb);
        cell.classList.toggle('rwd-cell-title', i === 0);
        cell.classList.toggle('rwd-cell-actions', i === row.children.length - 1 && /thao tác|hành động|phê duyệt|xử lý|actions|moderation|process/i.test(lb));
        /* Chỉ ở ≤768px: gói nội dung ô giá trị vào 1 phần tử để nhãn (::before) và giá trị luôn nằm
           đúng 2 cột, không tách rời chữ trần ("1" / "đơn"). Trên desktop gỡ ra -> giữ nguyên DOM gốc. */
        var isValue = i !== 0 && !cell.classList.contains('rwd-cell-actions') && lb;
        var only = cell.childNodes.length === 1 && cell.firstElementChild && cell.firstElementChild.classList.contains('rwd-val') ? cell.firstElementChild : null;
        if (isMobile() && isValue && !only) {
          var val = document.createElement('span');
          val.className = 'rwd-val';
          while (cell.firstChild) val.appendChild(cell.firstChild);
          cell.appendChild(val);
        } else if (!isMobile() && only) {
          while (only.firstChild) cell.insertBefore(only.firstChild, only);
          cell.removeChild(only);
        }
      });
    });
  }

  function wrapTables(root) {
    (root || document).querySelectorAll('table').forEach(function (t) {
      if (t.parentElement && t.parentElement.classList.contains('table-scroll')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', t.getAttribute('aria-label') || (typeof window.t === 'function' ? window.t('common.table_scroll_aria') : 'Bảng dữ liệu (vuốt ngang để xem thêm)'));
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  var pending = null;
  function refresh() {
    pending = null;
    document.querySelectorAll('.manage-table').forEach(labelTable);
    wrapTables(document);
  }
  function schedule() { if (!pending) pending = setTimeout(refresh, 40); }

  function start() {
    refresh();
    window.addEventListener('languageChanged', schedule);
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', schedule); else if (mq.addListener) mq.addListener(schedule); }
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (t.nodeType === 1 && (t.closest('.manage-table') || t.querySelector('table, .manage-table'))) { schedule(); return; }
          for (var j = 0; j < muts[i].addedNodes.length; j++) {
            var n = muts[i].addedNodes[j];
            if (n.nodeType === 1 && (n.matches('table, .manage-table, .table-row') || n.querySelector('table, .table-row'))) { schedule(); return; }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
