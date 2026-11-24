/* =========================================================
   i18n.js – Hệ thống đa ngôn ngữ Tiếng Việt (vi - mặc định) & Tiếng Anh (en)
   - Lưu ngôn ngữ vào localStorage (key: 'hourglass_lang', mặc định 'vi').
   - window.t(key, params): dịch theo key + nội suy biến {{...}}.
   - window.applyTranslations(root = document): dịch tự động các thuộc tính:
       data-i18n             -> textContent
       data-i18n-placeholder -> placeholder
       data-i18n-title       -> title & aria-label
       data-i18n-html        -> innerHTML
   - Khi đổi ngôn ngữ: cập nhật DOM ngay lập tức và bắn sự kiện
     window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }))
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'hourglass_lang';
  var DEFAULT_LANG = 'vi';
  var SUPPORTED = ['vi', 'en'];

  function readSavedLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        /* Hỗ trợ cả chuỗi thô 'en' hoặc JSON '"en"' */
        var clean = String(saved).replace(/^"|"$/g, '').trim().toLowerCase();
        if (SUPPORTED.indexOf(clean) !== -1) return clean;
      }
    } catch (e) {}
    return DEFAULT_LANG;
  }

  var currentLang = readSavedLang();

  function getDict(lang) {
    var locales = window.HG_LOCALES || {};
    return locales[lang] || locales[DEFAULT_LANG] || {};
  }

  /* Hàm dịch toàn cục hỗ trợ nội suy biến {{name}} */
  function t(key, params) {
    if (key == null) return '';
    var dict = getDict(currentLang);
    var fallbackDict = getDict(DEFAULT_LANG);
    var str = dict[key] != null ? dict[key] : (fallbackDict[key] != null ? fallbackDict[key] : String(key));
    if (params && typeof params === 'object') {
      str = String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, function (_, k) {
        return params[k] != null ? String(params[k]) : '';
      });
    }
    return str;
  }

  /* Dịch một phần tử nếu bản thân nó có gắn data-i18n* */
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.hasAttribute('data-i18n')) {
      var k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    }
    if (el.hasAttribute('data-i18n-html')) {
      var kh = el.getAttribute('data-i18n-html');
      if (kh) el.innerHTML = t(kh);
    }
    if (el.hasAttribute('data-i18n-placeholder')) {
      var kp = el.getAttribute('data-i18n-placeholder');
      if (kp) el.setAttribute('placeholder', t(kp));
    }
    if (el.hasAttribute('data-i18n-title')) {
      var kt = el.getAttribute('data-i18n-title');
      if (kt) {
        var val = t(kt);
        el.setAttribute('title', val);
        el.setAttribute('aria-label', val);
      }
    }
  }

  /* Cập nhật trạng thái active của các nút chuyển ngôn ngữ VI | EN */
  function syncLangSwitchers(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-lang-switch]').forEach(function (btn) {
      var code = btn.getAttribute('data-lang-switch');
      var active = code === currentLang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /* Dịch tự động toàn bộ cây DOM truyền vào (mặc định: document) */
  function applyTranslations(root) {
    var scope = root || document;
    if (scope === document && document.documentElement) {
      document.documentElement.setAttribute('lang', currentLang);
    }
    if (scope.nodeType === 1) {
      translateElement(scope);
    }
    if (scope.querySelectorAll) {
      scope.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-title]').forEach(translateElement);
    }
    syncLangSwitchers(scope);
  }

  /* Tạo chuỗi HTML cụm nút chuyển đổi ngôn ngữ VI | EN */
  function renderSwitcher(extraClass) {
    var cls = 'lang-switch' + (extraClass ? ' ' + extraClass : '');
    var label = t('nav.lang_label');
    return '<div class="' + cls + '" role="group" aria-label="' + label.replace(/"/g, '&quot;') + '" data-i18n-title="nav.lang_label">' +
      '<button type="button" class="lang-btn' + (currentLang === 'vi' ? ' active' : '') + '" data-lang-switch="vi" aria-pressed="' + (currentLang === 'vi') + '">VI</button>' +
      '<span class="lang-sep" aria-hidden="true">|</span>' +
      '<button type="button" class="lang-btn' + (currentLang === 'en' ? ' active' : '') + '" data-lang-switch="en" aria-pressed="' + (currentLang === 'en') + '">EN</button>' +
      '</div>';
  }

  /* Đổi ngôn ngữ, lưu localStorage, cập nhật DOM tức thì và bắn sự kiện languageChanged */
  function setLanguage(lang) {
    var next = String(lang || '').trim().toLowerCase();
    if (SUPPORTED.indexOf(next) === -1) next = DEFAULT_LANG;
    var changed = next !== currentLang;
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch (e) {}
    applyTranslations(document);
    if (changed || typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
    }
    return currentLang;
  }

  function getLanguage() {
    return currentLang;
  }

  /* Lắng nghe sự kiện click trên mọi nút [data-lang-switch] toàn trang */
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-lang-switch]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var targetLang = btn.getAttribute('data-lang-switch');
      if (targetLang && targetLang !== currentLang) {
        setLanguage(targetLang);
      }
    });

    /* Đồng bộ khi tab khác đổi ngôn ngữ */
    window.addEventListener('storage', function (e) {
      if (e && e.key === STORAGE_KEY) {
        var newLang = readSavedLang();
        if (newLang !== currentLang) {
          currentLang = newLang;
          applyTranslations(document);
          window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
        }
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { applyTranslations(document); });
    } else {
      applyTranslations(document);
    }
  }

  window.t = t;
  window.applyTranslations = applyTranslations;
  window.HGI18n = {
    STORAGE_KEY: STORAGE_KEY,
    t: t,
    getLang: getLanguage,
    setLang: setLanguage,
    applyTranslations: applyTranslations,
    renderSwitcher: renderSwitcher
  };
})();
