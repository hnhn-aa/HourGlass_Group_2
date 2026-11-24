/* =========================================================
   ai-assistant.js – Trợ lý AI HourGlass (widget khung chat nổi)
   Dùng chung cho student.html / employer.html / admin.html (nạp sau js/api.js, js/main.js):
   - Tự render khung chat vào <body>; mở bằng thẻ "Trợ lý AI HourGlass" ở sidebar
     ([data-ai-open]) hoặc nút nổi trên mobile.
   - Gửi câu hỏi tới Backend: POST {API_BASE_URL}/api/ai/chat  { message, role, history }
     · API_BASE_URL lấy từ HGApi.getBaseUrl() / HG_CONFIG (js/config.js).
     · Đính kèm JWT (hg_access_token) nếu đã đăng nhập → Backend dùng vai trò thật của tài khoản.
   - Lịch sử chat lưu trong sessionStorage theo TÀI KHOẢN + VAI TRÒ (giữ khi chuyển trang / tải lại).
   - Backend chưa bật / mất mạng / quá thời gian → hiện thông báo thân thiện + nút "Thử lại".
   - Có thể thay nguồn trả lời: HGAI.setResponder(fn) – fn(message, history, role)
     trả về Promise<{ reply, suggestions?, source? }>.
   ========================================================= */
(function () {
  'use strict';
  if (window.HGAI) return;

  /* Vai trò theo trang đang mở – dùng khi chưa xác định được tài khoản đăng nhập */
  var ROLE = (document.body.getAttribute('data-role') || 'student').toLowerCase();
  if (ROLE === 'recruiter') ROLE = 'employer';
  if (['student', 'employer', 'admin'].indexOf(ROLE) === -1) ROLE = 'student';

  var MAX_STORED = 40;
  var MAX_LEN = 2000;

  function tr(k, fb, p) { return window.t ? window.t(k, p) : (fb || k); }
  function curLang() {
    if (window.getCurrentLang) return window.getCurrentLang();
    try { return localStorage.getItem('hourglass_lang') === 'en' ? 'en' : 'vi'; } catch (e) { return 'vi'; }
  }

  function getRoleInfo(role) {
    if (role === 'employer') {
      return {
        label: tr('ai.emp.label', 'Nhà tuyển dụng'),
        welcome: tr('ai.emp.welcome', 'Xin chào! 👋 Mình là **HourGlass AI**. Mình có thể giúp bạn:\n- Viết tin tuyển dụng hấp dẫn sinh viên\n- Lọc & phỏng vấn ứng viên hiệu quả\n- Dùng bảng Kanban quản lý hồ sơ\nBạn cần hỗ trợ gì hôm nay?'),
        prompts: [
          tr('ai.emp.p1', 'Cách viết mô tả công việc'),
          tr('ai.emp.p2', 'Lọc ứng viên nhanh'),
          tr('ai.emp.p3', 'Câu hỏi phỏng vấn gợi ý'),
          tr('ai.emp.p4', 'Vì sao tin bị từ chối?')
        ],
        placeholder: tr('ai.emp.placeholder', 'Hỏi về đăng tin, ứng viên…')
      };
    }
    if (role === 'admin') {
      return {
        label: tr('ai.adm.label', 'Quản trị viên'),
        welcome: tr('ai.adm.welcome', 'Xin chào! 👋 Mình là **HourGlass AI**. Mình có thể hỗ trợ:\n- Quy trình kiểm duyệt tin đăng\n- Xử lý báo cáo – khiếu nại\n- Quản lý người dùng, danh mục & phân quyền\nBạn muốn xem hướng dẫn nào?'),
        prompts: [
          tr('ai.adm.p1', 'Quy trình duyệt tin'),
          tr('ai.adm.p2', 'Xử lý báo cáo khiếu nại'),
          tr('ai.adm.p3', 'Khi nào nên khóa tài khoản?'),
          tr('ai.adm.p4', 'Phân quyền quản trị viên')
        ],
        placeholder: tr('ai.adm.placeholder', 'Hỏi về kiểm duyệt, quản lý hệ thống…')
      };
    }
    return {
      label: tr('ai.stu.label', 'Sinh viên'),
      welcome: tr('ai.stu.welcome', 'Xin chào! 👋 Mình là **HourGlass AI**. Mình có thể giúp bạn:\n- Tìm việc part-time hợp lịch học\n- Viết CV & chuẩn bị phỏng vấn\n- Sắp xếp lịch rảnh, lịch làm\nBạn muốn bắt đầu từ đâu?'),
      prompts: [
        tr('ai.stu.p1', 'Tìm việc phù hợp'),
        tr('ai.stu.p2', 'Viết CV khi chưa có kinh nghiệm'),
        tr('ai.stu.p3', 'Sắp xếp lịch làm với lịch học'),
        tr('ai.stu.p4', 'Nhận diện tin tuyển dụng lừa đảo')
      ],
      placeholder: tr('ai.stu.placeholder', 'Hỏi về việc làm, CV, lịch làm…')
    };
  }
  function info() { return getRoleInfo(activeRole); }

  /* ---------- Icon (dùng sprite có sẵn + vài icon riêng của widget) ---------- */
  function useIcon(name, size) {
    return '<svg class="icon" width="' + size + '" height="' + size + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  var ICON_SEND = '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>';
  var ICON_MIN = '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
  var ICON_RESET = '<svg class="icon" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  /* ---------- Định dạng tin nhắn: in đậm, nghiêng, code, danh sách (an toàn XSS) ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function inline(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function renderRich(text) {
    var html = '', list = null;
    function closeList() { if (list) { html += '</' + list + '>'; list = null; } }
    esc(text).split(/\r?\n/).forEach(function (line) {
      var ul = line.match(/^\s*[-•*]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        var tag = ul ? 'ul' : 'ol';
        if (list !== tag) { closeList(); html += '<' + tag + '>'; list = tag; }
        html += '<li>' + inline((ul || ol)[1]) + '</li>';
      } else {
        closeList();
        if (line.trim()) html += '<p>' + inline(line) + '</p>';
      }
    });
    closeList();
    return html;
  }
  function timeNow() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ---------- Danh tính: vai trò + tài khoản (dùng để gửi API và tách lịch sử chat) ---------- */
  function normRole(r) {
    r = String(r || '').toLowerCase();
    if (r === 'recruiter') r = 'employer';
    return ['student', 'employer', 'admin'].indexOf(r) !== -1 ? r : '';
  }
  function sessionUserId() {
    try { var v = JSON.parse(localStorage.getItem('hg_session')); return v ? String(v) : ''; } catch (e) { return ''; }
  }
  function currentUser() {
    try { return window.HG && typeof window.HG.user === 'function' ? window.HG.user() : null; } catch (e) { return null; }
  }
  /* Ưu tiên vai trò của tài khoản đang đăng nhập; chưa có → theo trang đang mở (<body data-role>). */
  function currentRole() {
    var u = currentUser();
    return normRole(u && u.role) || ROLE;
  }

  /* ---------- Gọi Backend: POST /api/ai/chat ---------- */
  var REQUEST_TIMEOUT_MS = 30000;   // backend tự chuyển sang chế độ dự phòng sau AI_TIMEOUT (mặc định 20s)

  function apiBase() {
    try {
      if (window.HGApi && typeof window.HGApi.getBaseUrl === 'function') return window.HGApi.getBaseUrl();
      if (window.HG_CONFIG && typeof window.HG_CONFIG.getApiBase === 'function') return window.HG_CONFIG.getApiBase();
    } catch (e) {}
    return 'http://127.0.0.1:8000';
  }
  function accessToken() {
    try {
      if (window.HGApi && typeof window.HGApi.getToken === 'function') return window.HGApi.getToken();
      return localStorage.getItem('hg_access_token') || '';
    } catch (e) { return ''; }
  }
  function chatError(kind, message) { var e = new Error(message); e.kind = kind; return e; }

  /* Gọi fetch trực tiếp (không qua HGApi.request) để lỗi của khung chat KHÔNG hiện toast
     hay tự chuyển về trang đăng nhập; vẫn dùng chung Base URL và JWT của dự án. */
  var currentCtrl = null;   /* AbortController của câu hỏi đang chờ – để nút "Dừng" hủy được */
  function callApi(method, path, body) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.reject(chatError('offline', 'offline'));
    }
    if (window.HG_CONFIG && window.HG_CONFIG.configured === false) {
      return Promise.reject(chatError('network', 'unconfigured'));   /* bản deploy chưa khai báo URL Backend */
    }
    var headers = { Accept: 'application/json' };
    var token = accessToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body) headers['Content-Type'] = 'application/json';
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false;
    var timer = ctrl ? setTimeout(function () { timedOut = true; ctrl.abort(); }, REQUEST_TIMEOUT_MS) : null;
    if (path === '/api/ai/chat') currentCtrl = ctrl;

    return fetch(apiBase() + path, {
      method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
          if (!res.ok) {
            var detail = data && (data.detail || data.message);
            if (res.status === 422) throw chatError('invalid', typeof detail === 'string' ? detail : tr('ai.err_invalid', 'Câu hỏi chưa hợp lệ.'));
            if (res.status === 429) throw chatError('rate', 'rate');
            if (res.status === 404) throw chatError('missing', 'missing');
            throw chatError('server', 'HTTP ' + res.status);
          }
          return data;
        });
      }, function (err) {
        if (err && err.name === 'AbortError') throw chatError(timedOut ? 'timeout' : 'cancelled', 'aborted');
        throw chatError('network', String(err && err.message || err));
      })
      .then(function (data) { if (timer) clearTimeout(timer); return data; },
            function (err) { if (timer) clearTimeout(timer); throw err; });
  }

  function apiResponder(message, history, role) {
    return callApi('POST', '/api/ai/chat', { message: message, role: role, history: history, lang: curLang() }).then(function (data) {
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw chatError('server', 'empty');
      if (data.role && normRole(data.role)) activeRole = normRole(data.role);
      setStatus(data.source === 'llm' ? 'llm' : 'fallback', data.source === 'llm' ? data.model : '');
      return { reply: data.reply, suggestions: data.suggestions, source: data.source };
    });
  }
  var responder = apiResponder;

  function errorText(kind) {
    var map = {
      offline: tr('ai.err_offline', '📡 **Bạn đang ngoại tuyến.** Hãy kiểm tra kết nối Internet rồi bấm *Thử lại*.'),
      network: tr('ai.err_network', '🔌 **Chưa kết nối được máy chủ HourGlass.** Có thể Backend chưa được bật. Hãy chạy `uvicorn app.main:app --reload` trong thư mục `backend/` rồi bấm *Thử lại* nhé.'),
      timeout: tr('ai.err_timeout', '⏳ **Máy chủ phản hồi quá lâu.** Bạn thử gửi lại sau giây lát nhé.'),
      rate: tr('ai.err_rate', '🙏 **Bạn gửi hơi nhanh.** Chờ vài giây rồi bấm *Thử lại* nhé.'),
      missing: tr('ai.err_missing', '🧩 **Máy chủ chưa có chức năng Trợ lý AI.** Hãy cập nhật Backend (endpoint `POST /api/ai/chat`) rồi thử lại.'),
      server: tr('ai.err_server', '⚠️ **Máy chủ đang gặp sự cố.** Bạn thử lại sau ít phút nhé.'),
      cancelled: tr('ai.err_cancelled', '⏹ **Đã dừng chờ phản hồi.** Bấm *Thử lại* nếu bạn muốn hỏi lại câu này.')
    };
    return map[kind] || map.server;
  }

  /* ---------- Lưu hội thoại theo tài khoản + vai trò (sessionStorage) ---------- */
  var activeRole = currentRole();
  function storeKey() { return 'hg_ai_chat_v2_' + (sessionUserId() || 'guest') + '_' + activeRole; }
  var messages = [];
  function loadMessages() {
    messages = [];
    try { var v = JSON.parse(sessionStorage.getItem(storeKey())); if (Array.isArray(v)) messages = v; } catch (e) {}
  }
  function saveMessages() {
    try {
      // Chỉ có lời chào mặc định → không cần lưu (tránh tạo khóa rỗng cho mỗi trang đã mở)
      if (!messages.some(function (m) { return !m.intro; })) sessionStorage.removeItem(storeKey());
      else sessionStorage.setItem(storeKey(), JSON.stringify(messages.slice(-MAX_STORED)));
    } catch (e) {}
  }
  /* Lịch sử gửi lên Backend: bỏ lời chào mặc định và các thông báo lỗi */
  function historyForApi() {
    return messages
      .filter(function (m) { return !m.intro && !m.error && (m.role === 'user' || m.role === 'assistant'); })
      .slice(-20)
      .map(function (m) { return { role: m.role, content: m.content }; });
  }

  /* ---------- Render widget ---------- */
  var root = document.createElement('div');
  root.className = 'hg-ai';
  root.innerHTML =
    '<button type="button" class="hg-ai-fab" data-ai-open aria-label="Mở Trợ lý AI HourGlass" data-i18n-title="ai.fab_aria" aria-controls="hg-ai-panel" aria-expanded="false">' +
      useIcon('sparkle', 24) + '<span class="hg-ai-fab-dot" aria-hidden="true"></span></button>' +
    '<section class="hg-ai-panel" id="hg-ai-panel" role="dialog" aria-label="Trợ lý AI HourGlass" data-i18n-title="ai.panel_aria" aria-hidden="true">' +
      '<header class="hg-ai-head">' +
        '<span class="hg-ai-avatar" aria-hidden="true">' + useIcon('sparkle', 20) + '</span>' +
        '<div class="hg-ai-title"><strong>HourGlass AI</strong><small><i class="hg-ai-online" aria-hidden="true"></i><span data-ai-status>' + esc(tr('ai.status_online', 'Trực tuyến')) + '</span></small></div>' +
        '<div class="hg-ai-head-actions">' +
          '<button type="button" class="hg-ai-icon-btn" data-ai-reset title="Làm mới cuộc trò chuyện" aria-label="Làm mới cuộc trò chuyện" data-i18n-title="ai.btn_reset_title">' + ICON_RESET + '</button>' +
          '<button type="button" class="hg-ai-icon-btn" data-ai-min title="Thu gọn" aria-label="Thu gọn khung chat" data-i18n-title="ai.btn_min_title">' + ICON_MIN + '</button>' +
          '<button type="button" class="hg-ai-icon-btn" data-ai-close title="Đóng" aria-label="Đóng khung chat" data-i18n-title="ai.btn_close_title">' + useIcon('x', 18) + '</button>' +
        '</div>' +
      '</header>' +
      '<div class="hg-ai-body">' +
        '<div class="hg-ai-confirm" hidden role="alertdialog" aria-label="Xác nhận làm mới cuộc trò chuyện" data-i18n-title="ai.confirm_aria">' +
          '<span data-i18n="ai.confirm_msg">Xóa toàn bộ nội dung và bắt đầu cuộc trò chuyện mới?</span>' +
          '<button type="button" data-ai-confirm="no" data-i18n="ai.confirm_no">Hủy</button><button type="button" class="is-primary" data-ai-confirm="yes" data-i18n="ai.confirm_yes">Làm mới</button>' +
        '</div>' +
        '<div class="hg-ai-messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="hg-ai-chips" role="list" aria-label="Câu hỏi gợi ý" data-i18n-title="ai.chips_aria"></div>' +
        '<div class="hg-ai-queue" hidden><span data-ai-queue-text></span><button type="button" data-ai-queue-cancel aria-label="Hủy câu đang chờ gửi" data-i18n-title="ai.queue_cancel_aria">' + useIcon('x', 14) + '</button></div>' +
        '<form class="hg-ai-composer" autocomplete="off">' +
          '<label class="hg-ai-sr" for="hg-ai-input" data-i18n="ai.input_sr">Nhập câu hỏi cho Trợ lý AI</label>' +
          '<textarea id="hg-ai-input" rows="1" maxlength="' + MAX_LEN + '"></textarea>' +
          '<button type="submit" class="hg-ai-send" aria-label="Gửi" data-i18n-title="ai.send_aria" disabled>' + ICON_SEND + '</button>' +
        '</form>' +
        '<p class="hg-ai-note"><span data-ai-hint data-i18n="ai.hint_default">HourGlass AI có thể mắc lỗi – hãy kiểm tra lại thông tin quan trọng.</span><span class="hg-ai-count" data-ai-count hidden></span></p>' +
      '</div>' +
    '</section>';
  document.body.appendChild(root);
  if (window.applyTranslations) window.applyTranslations(root);

  var panel = root.querySelector('.hg-ai-panel');
  var fab = root.querySelector('.hg-ai-fab');
  var list = root.querySelector('.hg-ai-messages');
  var chips = root.querySelector('.hg-ai-chips');
  var form = root.querySelector('.hg-ai-composer');
  var input = root.querySelector('#hg-ai-input');
  var sendBtn = root.querySelector('.hg-ai-send');
  var confirmBar = root.querySelector('.hg-ai-confirm');
  var statusEl = root.querySelector('[data-ai-status]');
  var queueBar = root.querySelector('.hg-ai-queue'), queueText = root.querySelector('[data-ai-queue-text]');
  var countEl = root.querySelector('[data-ai-count]'), hintEl = root.querySelector('[data-ai-hint]');
  var busy = false, lastOpener = null, statusChecked = false, queued = '', waitTimers = [];
  var lastState = 'fallback', lastModel = '';
  var mqSheet = window.matchMedia('(max-width: 560px)');

  /* ---------- Trạng thái kết nối trên header ---------- */
  function setStatus(state, model) {
    lastState = state || 'fallback';
    lastModel = model || '';
    root.classList.toggle('is-offline', state === 'offline');
    root.classList.toggle('is-checking', state === 'checking');
    var label = info().label;
    statusEl.textContent =
      state === 'offline' ? tr('ai.status_offline', 'Mất kết nối máy chủ') :
      state === 'checking' ? tr('ai.status_checking', 'Đang kết nối…') :
      state === 'llm' ? tr('ai.status_llm', 'Trực tuyến · AI' + (model ? ' (' + model + ')' : ''), { model: model ? ' (' + model + ')' : '' }) :
      tr('ai.status_support', 'Trực tuyến · Hỗ trợ ' + label, { role: label });
  }
  function checkStatus() {
    statusChecked = true;
    setStatus('checking');
    callApi('GET', '/api/ai/status').then(function (d) {
      setStatus(d && d.mode === 'llm' ? 'llm' : 'fallback', d && d.mode === 'llm' ? d.model : '');
    }, function () { setStatus('offline'); });
  }

  /* ---------- Render tin nhắn ---------- */
  function bubbleHtml(m, idx) {
    var isUser = m.role === 'user';
    var content = m.intro ? info().welcome : (m.error && m.errKind ? errorText(m.errKind) : m.content);
    var meta = esc(m.time || '') + (m.source === 'fallback' ? esc(tr('ai.basic_mode', ' · Chế độ cơ bản')) : '');
    var retry = m.error && idx === messages.length - 1
      ? '<button type="button" class="hg-ai-retry" data-ai-retry>' + ICON_RESET + ' ' + esc(tr('ai.btn_retry', 'Thử lại')) + '</button>' : '';
    return '<div class="hg-ai-msg ' + (isUser ? 'is-user' : 'is-ai') + (m.error ? ' is-error' : '') + '">' +
      (isUser ? '' : '<span class="hg-ai-msg-avatar" aria-hidden="true">' + (m.error ? useIcon('alert', 14) : useIcon('sparkle', 14)) + '</span>') +
      '<div class="hg-ai-msg-col"><div class="hg-ai-bubble">' + (isUser ? '<p>' + esc(content).replace(/\n/g, '<br>') + '</p>' : renderRich(content)) + retry + '</div>' +
      '<time>' + meta + '</time></div></div>';
  }
  function scrollToBottom(smooth) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (list.scrollTo) list.scrollTo({ top: list.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    else list.scrollTop = list.scrollHeight;
  }
  function renderAll() {
    list.innerHTML = '<div class="hg-ai-day">' + esc(tr('ai.day_today', 'Hôm nay')) + '</div>' + messages.map(bubbleHtml).join('');
    scrollToBottom(false);
  }
  function appendMessage(m) {
    messages.push(m); saveMessages();
    list.insertAdjacentHTML('beforeend', bubbleHtml(m, messages.length - 1));
    scrollToBottom(true);
  }
  function dropTrailingError() {
    if (messages.length && messages[messages.length - 1].error) {
      messages.pop(); saveMessages();
      var nodes = list.querySelectorAll('.hg-ai-msg.is-error');
      if (nodes.length) nodes[nodes.length - 1].remove();
    }
  }
  var customChips = null;
  function renderChips(items) {
    if (items !== undefined) customChips = items && items.length ? items : null;
    var activePrompts = customChips || info().prompts;
    chips.innerHTML = activePrompts.slice(0, 5).map(function (p) {
      return '<button type="button" class="hg-ai-chip" role="listitem" data-ai-prompt="' + esc(p) + '">' + esc(p) + '</button>';
    }).join('');
    chips.scrollLeft = 0;
  }
  function showTyping(on) {
    var el = list.querySelector('.hg-ai-typing');
    waitTimers.forEach(clearTimeout); waitTimers = [];
    if (on && !el) {
      list.insertAdjacentHTML('beforeend',
        '<div class="hg-ai-msg is-ai hg-ai-typing"><span class="hg-ai-msg-avatar" aria-hidden="true">' + useIcon('sparkle', 14) + '</span>' +
        '<div class="hg-ai-bubble"><span class="hg-ai-dots" aria-hidden="true"><i></i><i></i><i></i></span><span data-ai-wait>' + esc(tr('ai.thinking', 'AI đang suy nghĩ…')) + '</span>' +
        '<button type="button" class="hg-ai-stop" data-ai-stop hidden>' + esc(tr('ai.btn_stop', 'Dừng')) + '</button></div></div>');
      scrollToBottom(true);
      /* Chờ lâu: đổi lời nhắn để người dùng biết hệ thống vẫn đang xử lý, và cho phép dừng */
      var stage = function (ms, textKey, fb, showStop) {
        waitTimers.push(setTimeout(function () {
          var t = list.querySelector('[data-ai-wait]'); if (t) t.textContent = tr(textKey, fb);
          var b = list.querySelector('[data-ai-stop]'); if (b && showStop) b.hidden = false;
          scrollToBottom(true);
        }, ms));
      };
      stage(6000, 'ai.wait_6s', 'Câu hỏi cần thêm chút thời gian, AI vẫn đang xử lý…', true);
      stage(15000, 'ai.wait_15s', 'Máy chủ phản hồi chậm hơn bình thường – bạn có thể chờ thêm hoặc bấm Dừng.', true);
    } else if (!on && el) el.remove();
  }
  function updateCount() {
    var n = input.value.length;
    countEl.hidden = n < MAX_LEN * 0.8;
    countEl.textContent = n + '/' + MAX_LEN;
    countEl.classList.toggle('is-max', n >= MAX_LEN);
  }
  var hintTimer = null;
  function flashHint(text) {
    hintEl.textContent = text; root.classList.add('has-hint');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hintEl.textContent = tr('ai.hint_default', 'HourGlass AI có thể mắc lỗi – hãy kiểm tra lại thông tin quan trọng.'); root.classList.remove('has-hint'); }, 4000);
  }
  /* Hàng chờ: gửi liên tiếp khi AI đang trả lời -> gom vào 1 câu, tự gửi ngay sau khi có câu trả lời */
  function renderQueue() {
    queueBar.hidden = !queued;
    var shortQ = queued.length > 80 ? queued.slice(0, 80) + '…' : queued;
    queueText.textContent = queued ? tr('ai.queue_prefix', 'Sẽ gửi tiếp: ' + shortQ, { text: shortQ }) : '';
  }
  function updateSendState() {
    sendBtn.disabled = !input.value.trim();   /* đang chờ vẫn bấm được -> câu mới vào hàng chờ */
    root.classList.toggle('is-busy', busy);
  }
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 112) + 'px';
  }
  function applyRoleTexts() {
    input.placeholder = info().placeholder;
    setStatus(lastState, lastModel);
  }

  /* ---------- Gửi câu hỏi ---------- */
  function ask(text) {
    var history = historyForApi();
    if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].content === text) history.pop();
    busy = true; updateSendState(); showTyping(true);
    Promise.resolve()
      .then(function () { return responder(text, history, activeRole); })
      .then(function (res) {
        showTyping(false);
        var reply = res && res.reply ? String(res.reply) : tr('ai.fallback_empty', 'Xin lỗi, mình chưa có câu trả lời phù hợp. Bạn thử hỏi cách khác nhé.');
        appendMessage({ role: 'assistant', content: reply, time: timeNow(), source: res && res.source });
        renderChips(res && res.suggestions);
      })
      .catch(function (err) {
        showTyping(false);
        var kind = (err && err.kind) || 'server';
        if (kind === 'network' || kind === 'offline') setStatus('offline');
        var text2 = kind === 'invalid' ? '✋ ' + err.message : errorText(kind);
        appendMessage({ role: 'assistant', content: text2, time: timeNow(), error: true, errKind: kind === 'invalid' ? '' : kind });
      })
      .then(function () {
        busy = false; currentCtrl = null; updateSendState();
        if (queued) { var next = queued; queued = ''; renderQueue(); send(next); return; }
        if (isOpen() && !mqSheet.matches) input.focus();
      });
  }
  function send(text) {
    text = String(text || '').trim().slice(0, MAX_LEN);
    if (!text) return;
    if (busy) {
      /* Không bỏ qua im lặng: đưa vào hàng chờ (gộp các câu gửi liên tiếp) và xóa ô nhập */
      var merged = queued ? queued + '\n' + text : text;
      if (merged.length > MAX_LEN) { flashHint(tr('ai.queue_full', 'Hàng chờ đã đầy – hãy đợi AI trả lời xong rồi gửi tiếp nhé.')); return; }
      queued = merged; renderQueue();
      input.value = ''; autoGrow(); updateCount(); updateSendState();
      return;
    }
    dropTrailingError();
    appendMessage({ role: 'user', content: text, time: timeNow() });
    input.value = ''; autoGrow(); updateCount(); updateSendState();
    ask(text);
  }
  function retryLast() {
    if (busy) return;
    dropTrailingError();
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { ask(messages[i].content); return; }
    }
  }

  function resetConversation() {
    queued = ''; customChips = null; renderQueue();
    messages = [{ role: 'assistant', content: info().welcome, time: timeNow(), intro: true }];
    saveMessages(); renderAll(); renderChips(); hideConfirm();
  }
  function showConfirm() {
    var hasChat = messages.some(function (m) { return !m.intro; });
    if (!hasChat) { resetConversation(); return; }
    confirmBar.hidden = false;
    confirmBar.querySelector('[data-ai-confirm="yes"]').focus();
  }
  function hideConfirm() { confirmBar.hidden = true; }

  /* Đổi tài khoản/vai trò (VD đăng nhập tài khoản khác ở tab khác) → nạp đúng lịch sử */
  function syncIdentity() {
    var role = currentRole(), key = 'hg_ai_chat_v2_' + (sessionUserId() || 'guest') + '_' + role;
    if (role === activeRole && key === storeKey() && messages.length) return;
    activeRole = role;
    loadMessages();
    if (!messages.length) resetConversation(); else { renderAll(); renderChips(); }
    applyRoleTexts();
  }

  /* ---------- Mở / đóng / thu gọn ---------- */
  function isOpen() { return root.classList.contains('is-open'); }
  function setExpanded(v) {
    document.querySelectorAll('[data-ai-open]').forEach(function (b) { b.setAttribute('aria-expanded', v ? 'true' : 'false'); });
  }
  function open(opener) {
    lastOpener = opener || document.activeElement;
    syncIdentity();
    // Trên mobile: đóng ngăn kéo sidebar trước khi mở chat
    var backdrop = document.getElementById('dash-backdrop');
    if (backdrop && !backdrop.hidden) backdrop.click();
    root.classList.add('is-open');
    root.classList.remove('is-min');
    panel.setAttribute('aria-hidden', 'false');
    setExpanded(true);
    document.body.classList.toggle('hg-ai-lock', mqSheet.matches);
    if (!statusChecked || root.classList.contains('is-offline')) checkStatus();
    scrollToBottom(false);
    setTimeout(function () { if (!mqSheet.matches) input.focus(); else panel.querySelector('[data-ai-close]').focus(); }, 60);
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('is-open', 'is-min');
    panel.setAttribute('aria-hidden', 'true');
    setExpanded(false);
    hideConfirm();
    document.body.classList.remove('hg-ai-lock');
    if (lastOpener && document.contains(lastOpener) && lastOpener.offsetParent !== null) lastOpener.focus();
    else fab.focus({ preventScroll: true });
  }
  function toggleMin() {
    if (mqSheet.matches) { close(); return; }
    root.classList.toggle('is-min');
    if (!root.classList.contains('is-min')) { scrollToBottom(false); input.focus(); }
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-ai-open]');
    if (opener) { e.preventDefault(); if (isOpen() && !root.classList.contains('is-min')) close(); else open(opener); }
  });
  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-ai-close]')) { close(); return; }
    if (e.target.closest('[data-ai-min]')) { toggleMin(); return; }
    if (e.target.closest('[data-ai-reset]')) { if (!busy) showConfirm(); return; }
    var c = e.target.closest('[data-ai-confirm]');
    if (c) { if (c.getAttribute('data-ai-confirm') === 'yes') resetConversation(); else hideConfirm(); input.focus(); return; }
    if (e.target.closest('[data-ai-retry]')) { retryLast(); return; }
    if (e.target.closest('[data-ai-stop]')) { if (currentCtrl) currentCtrl.abort(); return; }
    if (e.target.closest('[data-ai-queue-cancel]')) {
      if (!input.value.trim()) { input.value = queued; autoGrow(); updateCount(); }   /* trả câu đang chờ về ô nhập để sửa */
      queued = ''; renderQueue(); updateSendState(); input.focus(); return;
    }
    var chip = e.target.closest('[data-ai-prompt]');
    if (chip) { send(chip.getAttribute('data-ai-prompt')); return; }
    if (root.classList.contains('is-min') && e.target.closest('.hg-ai-head')) toggleMin();
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('input', function () { autoGrow(); updateSendState(); updateCount(); });
  /* Dán đoạn văn dài hơn giới hạn: báo rõ thay vì cắt bớt im lặng */
  input.addEventListener('paste', function (e) {
    var pasted = (e.clipboardData || window.clipboardData);
    pasted = pasted ? pasted.getData('text') : '';
    var room = MAX_LEN - (input.value.length - (input.selectionEnd - input.selectionStart));
    if (pasted.length > room) flashHint(tr('ai.paste_trimmed', 'Nội dung dài hơn ' + MAX_LEN + ' ký tự nên đã được cắt bớt. Hãy chia thành nhiều câu hỏi ngắn hơn.', { max: MAX_LEN }));
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen() || !panel.contains(document.activeElement)) return;
    if (!confirmBar.hidden) { hideConfirm(); input.focus(); } else close();
  });
  var onMq = function () { document.body.classList.toggle('hg-ai-lock', isOpen() && mqSheet.matches); };
  if (mqSheet.addEventListener) mqSheet.addEventListener('change', onMq); else mqSheet.addListener(onMq);
  window.addEventListener('online', function () { if (isOpen()) checkStatus(); });
  window.addEventListener('offline', function () { setStatus('offline'); });
  window.addEventListener('languageChanged', function () {
    if (window.applyTranslations) window.applyTranslations(root);
    customChips = null;
    messages.forEach(function (m) {
      if (m.intro) m.content = info().welcome;
    });
    renderAll();
    renderChips();
    renderQueue();
    applyRoleTexts();
  });

  /* ---------- Khởi tạo ---------- */
  loadMessages();
  if (!messages.length) resetConversation(); else { renderAll(); renderChips(); }
  applyRoleTexts();

  window.HGAI = {
    open: open,
    close: close,
    send: send,
    reset: resetConversation,
    role: function () { return activeRole; },
    checkStatus: checkStatus,
    /* Thay nguồn trả lời (VD giả lập khi kiểm thử); truyền null để quay về API thật */
    setResponder: function (fn) { responder = typeof fn === 'function' ? fn : apiResponder; }
  };
})();
