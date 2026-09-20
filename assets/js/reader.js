/* Arena Short Stories — reading page. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var id = new URLSearchParams(location.search).get('id');

  function fail(msg) {
    $('#loading').hidden = true;
    $('#reader').hidden = true;
    $('#pagenav').hidden = true;
    var box = $('#readerError');
    box.querySelector('p').textContent = msg;
    box.hidden = false;
  }

  if (!id) {
    fail('No story was selected. Head back to the shelf and pick one.');
    return;
  }

  var listPromise = ASS.fetchJSON('stories/index.json').then(function (d) {
    return ASS.sortStories(d && d.stories);
  }).catch(function () {
    return [];
  });

  ASS.fetchJSON('stories/' + encodeURIComponent(id) + '.json')
    .then(function (story) {
      return listPromise.then(function (list) {
        var pos = -1;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) { pos = i; break; }
        }
        var full = Object.assign({}, pos >= 0 ? list[pos] : {}, story);

        document.title = (full.title || 'A story') + ' · Arena Short Stories';
        $('#reader').innerHTML = ASS.storyArticle(full, { copyLink: true });
        $('#loading').hidden = true;

        /* Copy-link button */
        var copy = $('#copyLinkBtn');
        if (copy) {
          copy.addEventListener('click', function () {
            var done = function () {
              copy.textContent = 'Link copied ✓';
              setTimeout(function () { copy.textContent = 'Copy link'; }, 1800);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(location.href).then(done, done);
            } else {
              done();
            }
          });
        }

        /* Prev / next (newest-first list: newer sits above, older below) */
        if (pos >= 0) {
          var newer = list[pos - 1] || null;
          var older = list[pos + 1] || null;
          var html = '';
          html += newer
            ? '<a class="prev" href="story.html?id=' + encodeURIComponent(newer.id) +
              '"><span class="dir">Newer</span><span class="pt">' + ASS.esc(newer.title) + '</span></a>'
            : '<span class="pad"></span>';
          html += older
            ? '<a class="next" href="story.html?id=' + encodeURIComponent(older.id) +
              '"><span class="dir">Older</span><span class="pt">' + ASS.esc(older.title) + '</span></a>'
            : '<span class="pad"></span>';
          var nav = $('#pagenav');
          nav.innerHTML = html;
          nav.hidden = false;
        }
      });
    })
    .catch(function () {
      fail('That story could not be found. It may have been removed, or the link is out of date.');
    });
})();
