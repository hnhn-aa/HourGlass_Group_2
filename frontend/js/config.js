/* =========================================================
   config.js – CẤU HÌNH MÔI TRƯỜNG FRONTEND (nạp ĐẦU TIÊN trong <head> mọi trang)
   ---------------------------------------------------------
   Quyết định địa chỉ Backend API (window.HG_CONFIG.apiBase) theo thứ tự ưu tiên:

     1. Tham số URL  ?api=<url>      – đổi nhanh khi thử nghiệm (được ghi nhớ trong trình duyệt)
                     ?api=reset      – xóa giá trị đã ghi nhớ, quay về mặc định
     2. Giá trị đã ghi nhớ           – localStorage "hg_api_base" (HGApi.setBaseUrl(url) cũng ghi vào đây)
     3. Môi trường LOCAL             – trang mở từ localhost / 127.0.0.1 / IP mạng LAN / file://
                                       -> http://<cùng host>:8000  (mặc định http://127.0.0.1:8000)
     4. Môi trường PRODUCTION        – mọi tên miền khác (vd: *.vercel.app) -> PRODUCTION_API_BASE
                                       ('/' = cùng tên miền với Frontend, dùng khi Backend phục vụ luôn
                                        Frontend hoặc khi cấu hình proxy rewrites trên Vercel)

   ► KHI DEPLOY: chỉ cần sửa hằng số PRODUCTION_API_BASE bên dưới thành URL HTTPS của Backend.
     Nếu quên sửa (vẫn là URL mẫu), Frontend KHÔNG gọi API (HG_CONFIG.configured = false) mà
     chạy bằng dữ liệu đồng bộ gần nhất / dữ liệu mẫu, kèm cảnh báo trong console.
   ========================================================= */
(function (window) {
  'use strict';

  /* ── 1. CHỈNH Ở ĐÂY KHI DEPLOY ───────────────────────────────────────── */
  var PRODUCTION_API_BASE = 'https://hourglass-api.example.com';   // ← thay bằng URL Backend thật (HTTPS, không có "/" ở cuối)
  var LOCAL_API_PORT = 8000;                                       // cổng uvicorn khi chạy local
  /* ─────────────────────────────────────────────────────────────────────── */

  var STORAGE_KEY = 'hg_api_base';
  var PLACEHOLDER_HOST = 'hourglass-api.example.com';

  function clean(url) { return String(url || '').trim().replace(/\/+$/, ''); }
  function isValidUrl(url) { return /^https?:\/\/[^\s/]+/i.test(url); }
  function store(op, value) {
    try {
      if (op === 'get') return window.localStorage.getItem(STORAGE_KEY);
      if (op === 'set') window.localStorage.setItem(STORAGE_KEY, value);
      if (op === 'del') window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* chế độ ẩn danh / chặn storage: bỏ qua */ }
    return null;
  }

  var loc = window.location || {};
  var host = String(loc.hostname || '');
  var isLocalHost =
    loc.protocol === 'file:' || host === '' ||
    host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]' || host === '::1' ||
    /\.local$/i.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);

  var ENV = isLocalHost ? 'local' : 'production';
  /* localhost / ::1 / 0.0.0.0 / file:// -> 127.0.0.1: khớp đúng địa chỉ uvicorn lắng nghe theo README
     (uvicorn --host 127.0.0.1), tránh trình duyệt thử IPv6 (::1) trước rồi mới lùi về IPv4.
     IP mạng LAN (192.168.x.x...) giữ nguyên để điện thoại cùng Wi-Fi gọi được Backend. */
  var LOOPBACK = { '': 1, 'localhost': 1, '127.0.0.1': 1, '0.0.0.0': 1, '[::1]': 1, '::1': 1 };
  var apiHost = (loc.protocol === 'file:' || LOOPBACK[host]) ? '127.0.0.1' : host;
  var LOCAL_API_BASE = 'http://' + apiHost + ':' + LOCAL_API_PORT;

  /* PRODUCTION_API_BASE: URL đầy đủ | '/' (cùng tên miền) | URL mẫu (chưa cấu hình) */
  var prodRaw = clean(PRODUCTION_API_BASE);
  var PROD_SAME_ORIGIN = prodRaw === '' && String(PRODUCTION_API_BASE).trim() === '/';
  var PROD_CONFIGURED = PROD_SAME_ORIGIN || (isValidUrl(prodRaw) && prodRaw.indexOf(PLACEHOLDER_HOST) === -1);
  var PROD_API_BASE = PROD_SAME_ORIGIN ? clean(loc.origin || '') : prodRaw;
  var DEFAULT_API_BASE = ENV === 'local' ? LOCAL_API_BASE : (PROD_CONFIGURED ? PROD_API_BASE : '');

  /* ?api=<url> | ?api=reset : ghi đè nhanh, không cần sửa code (tiện khi test bản Preview trên Vercel) */
  try {
    var q = new URLSearchParams(loc.search || '').get('api');
    if (q) {
      if (q === 'reset' || q === 'default') store('del');
      else if (isValidUrl(clean(q))) store('set', clean(q));
      else if (window.console) console.warn('[HourGlass] Bỏ qua ?api= không hợp lệ:', q);
    }
  } catch (e) {}

  function resolve() {
    var saved = clean(store('get'));
    if (saved && isValidUrl(saved)) return { url: saved, source: 'override', configured: true };
    return { url: DEFAULT_API_BASE, source: ENV, configured: ENV === 'local' || PROD_CONFIGURED };
  }

  var current = resolve();

  var HG_CONFIG = {
    env: ENV,                           // 'local' | 'production'
    apiBase: current.url,               // URL Backend đang dùng
    source: current.source,             // 'local' | 'production' | 'override'
    configured: current.configured,     // false = bản deploy chưa khai báo URL Backend -> api.js không gọi mạng
    localApiBase: LOCAL_API_BASE,
    productionApiBase: PROD_API_BASE,
    getApiBase: function () { return HG_CONFIG.apiBase; },
    /* Ghi đè URL Backend (lưu trong trình duyệt). Truyền rỗng để quay về mặc định. */
    setApiBase: function (url) {
      var u = clean(url);
      if (u && !isValidUrl(u)) throw new Error('URL Backend không hợp lệ: ' + url);
      if (u) store('set', u); else store('del');
      var r = resolve();
      HG_CONFIG.apiBase = r.url; HG_CONFIG.source = r.source; HG_CONFIG.configured = r.configured;
      return HG_CONFIG.apiBase;
    },
    resetApiBase: function () { return HG_CONFIG.setApiBase(''); }
  };
  window.HG_CONFIG = HG_CONFIG;

  /* Cảnh báo cấu hình sai thường gặp khi deploy */
  if (window.console) {
    if (!HG_CONFIG.configured) {
      console.warn('[HourGlass] Chưa cấu hình PRODUCTION_API_BASE trong frontend/js/config.js – Frontend chưa gọi Backend thật (đang dùng dữ liệu đồng bộ gần nhất / dữ liệu mẫu). Thử nhanh: thêm ?api=https://<backend> vào URL.');
    }
    if (loc.protocol === 'https:' && /^http:\/\//i.test(HG_CONFIG.apiBase)) {
      console.warn('[HourGlass] Trang chạy HTTPS nhưng Backend là HTTP (' + HG_CONFIG.apiBase + '): trình duyệt sẽ chặn (mixed content). Hãy dùng Backend HTTPS.');
    }
  }
})(window);
