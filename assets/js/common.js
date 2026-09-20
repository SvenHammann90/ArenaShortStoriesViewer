/* Arena Short Stories — shared helpers. No dependencies. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function words(text) {
    var t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function readMins(n) {
    return Math.max(1, Math.round((n || 0) / 220));
  }

  function parseDate(iso) {
    if (!iso) return null;
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T00:00:00' : iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(iso) {
    var d = parseDate(iso);
    if (!d) return String(iso || '');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtMonth(iso) {
    var d = parseDate(iso);
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  /* Cache-busting fetch so freshly published stories show up promptly. */
  function fetchJSON(url) {
    var bust = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    return fetch(bust, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function b64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '');
  }

  /* Minimal, safe rich-text rendering for prompts and story bodies.
     Supports: paragraphs (blank-line separated), #–### headings,
     **bold**, *italic*, `code`, > blockquotes and --- dividers. */
  function inlineMd(s) {
    return s
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function renderRich(text) {
    var src = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!src) return '';
    return src.split(/\n{2,}/).map(function (block) {
      var t = block.trim();
      if (!t) return '';
      if (/^([-*_])(\s*\1){2,}$/.test(t)) return '<hr>';
      var h = t.match(/^(#{1,3})\s+(.+)$/);
      if (h) {
        var lvl = h[1].length + 1;
        return '<h' + lvl + '>' + inlineMd(esc(h[2])) + '</h' + lvl + '>';
      }
      var lines = t.split('\n');
      if (lines.every(function (l) { return /^>/.test(l); })) {
        var inner = lines.map(function (l) { return l.replace(/^>\s?/, ''); }).join('\n');
        return '<blockquote>' + inlineMd(esc(inner)) + '</blockquote>';
      }
      return '<p>' + inlineMd(esc(t)) + '</p>';
    }).join('');
  }

  /* Newest first: by date, then by when it was added. */
  function sortStories(list) {
    return (list || []).slice().sort(function (a, b) {
      var da = a.date || '', db = b.date || '';
      if (da !== db) return da < db ? 1 : -1;
      var aa = a.addedAt || '', ab = b.addedAt || '';
      if (aa !== ab) return aa < ab ? 1 : -1;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }

  /* Shared markup for one story, used by the reading page and the admin preview. */
  function storyArticle(s, opts) {
    opts = opts || {};
    s = s || {};
    var mins = readMins(s.words || words(s.story));

    var meta = '<p class="story-meta">';
    if (s.model) meta += '<span class="chip">' + esc(s.model) + '</span>';
    if (s.date) meta += '<span>' + esc(fmtDate(s.date)) + '</span>';
    meta += '<span>' + mins + ' min read</span>';
    if (opts.copyLink) meta += '<button class="copylink" type="button" id="copyLinkBtn">Copy link</button>';
    meta += '</p>';

    var prompt = String(s.prompt || '').trim()
      ? '<section class="prompt"><p class="label">The prompt</p><div class="prompt-body">' +
        renderRich(s.prompt) + '</div></section><div class="ornament" aria-hidden="true"></div>'
      : '';

    return (
      '<h1 class="story-title">' + esc(s.title || 'Untitled') + '</h1>' +
      meta + prompt +
      '<div class="body">' + renderRich(s.story || '') + '</div>' +
      '<div class="ornament end" aria-hidden="true"></div>'
    );
  }

  /* Theme toggle (the initial theme is set inline in <head> to avoid flashing). */
  var toggle = document.getElementById('themeToggle');
  var metaColor = document.querySelector('meta[name="theme-color"]');

  function applyMetaColor() {
    if (metaColor) {
      metaColor.setAttribute('content',
        document.documentElement.dataset.theme === 'dark' ? '#191713' : '#faf7f1');
    }
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('ass-theme', next); } catch (e) { /* private mode */ }
      applyMetaColor();
    });
  }
  applyMetaColor();

  window.ASS = {
    esc: esc,
    words: words,
    readMins: readMins,
    fmtDate: fmtDate,
    fmtMonth: fmtMonth,
    fetchJSON: fetchJSON,
    b64ToUtf8: b64ToUtf8,
    slugify: slugify,
    renderRich: renderRich,
    sortStories: sortStories,
    storyArticle: storyArticle
  };
})();
