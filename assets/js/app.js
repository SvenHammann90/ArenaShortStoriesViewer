/* Arena Short Stories — public list page. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var stories = [];
  var query = '';
  var model = null; /* null = all models */

  function excerpt(p, n) {
    p = String(p || '').replace(/\s+/g, ' ').trim();
    if (p.length <= n) return p;
    var cut = p.slice(0, n);
    var lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  function filtered() {
    var q = query.trim().toLowerCase();
    return stories.filter(function (s) {
      if (model && s.model !== model) return false;
      if (!q) return true;
      return ['title', 'model', 'prompt'].some(function (k) {
        return String(s[k] || '').toLowerCase().indexOf(q) >= 0;
      });
    });
  }

  function renderList() {
    var list = filtered();
    var box = $('#list');
    var noMatch = $('#noMatch');

    if (!list.length) {
      box.innerHTML = '';
      noMatch.hidden = stories.length === 0;
      return;
    }
    noMatch.hidden = true;

    var html = '';
    var lastMonth = null;

    list.forEach(function (s, i) {
      var month = String(s.date || '').slice(0, 7);
      if (month !== lastMonth) {
        if (lastMonth !== null) html += '</div></section>';
        html += '<section class="month"><h2 class="month-label">' +
                ASS.esc(ASS.fmtMonth(s.date) || 'Undated') +
                '</h2><div class="entries">';
        lastMonth = month;
      }
      html +=
        '<a class="entry" href="story.html?id=' + encodeURIComponent(s.id) + '">' +
          '<span class="entry-no">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="entry-main">' +
            '<h3 class="entry-title">' + ASS.esc(s.title || 'Untitled') + '</h3>' +
            '<p class="entry-meta">' +
              (s.model ? '<span class="chip">' + ASS.esc(s.model) + '</span>' : '') +
              (s.date ? '<span>' + ASS.esc(ASS.fmtDate(s.date)) + '</span>' : '') +
              '<span>' + ASS.readMins(s.words) + ' min</span>' +
            '</p>' +
            (s.prompt
              ? '<p class="entry-prompt">“' + ASS.esc(excerpt(s.prompt, 150)) + '”</p>'
              : '') +
          '</span>' +
          '<span class="entry-arrow" aria-hidden="true">→</span>' +
        '</a>';
    });
    if (lastMonth !== null) html += '</div></section>';

    box.innerHTML = html;
  }

  function renderChips() {
    var counts = {};
    stories.forEach(function (s) {
      if (s.model) counts[s.model] = (counts[s.model] || 0) + 1;
    });
    var models = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    });

    var html = '<button type="button" class="chip-btn' + (model ? '' : ' active') +
               '" data-model="">All <span class="n">' + stories.length + '</span></button>';
    models.forEach(function (m) {
      html += '<button type="button" class="chip-btn' + (model === m ? ' active' : '') +
              '" data-model="' + ASS.esc(m) + '">' + ASS.esc(m) +
              ' <span class="n">' + counts[m] + '</span></button>';
    });
    $('#chips').innerHTML = html;
  }

  $('#chips').addEventListener('click', function (ev) {
    var btn = ev.target.closest('.chip-btn');
    if (!btn) return;
    model = btn.dataset.model || null;
    renderChips();
    renderList();
  });

  var debounceId = null;
  $('#q').addEventListener('input', function (ev) {
    query = ev.target.value;
    clearTimeout(debounceId);
    debounceId = setTimeout(renderList, 140);
  });

  /* ---- boot ---- */
  ASS.fetchJSON('stories/index.json').then(function (data) {
    stories = ASS.sortStories(data && data.stories);

    var models = {};
    stories.forEach(function (s) { if (s.model) models[s.model] = 1; });
    var nModels = Object.keys(models).length;

    if (!stories.length) {
      $('#heroStats').hidden = true;
      $('#empty').hidden = false;
      return;
    }

    $('#heroStats').textContent =
      stories.length + ' ' + plural(stories.length, 'story', 'stories') +
      ' · ' + nModels + ' ' + plural(nModels, 'model', 'models') +
      ' · newest ' + ASS.fmtDate(stories[0].date);

    $('#toolbar').hidden = false;
    renderChips();
    renderList();
  }).catch(function () {
    $('#heroStats').hidden = true;
    $('#loadError').hidden = false;
  });
})();
