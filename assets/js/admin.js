/* Arena Short Stories — curator studio.
   Publishes stories to this repository as ordinary commits through the
   GitHub REST API, using a personal access token that never leaves the
   curator's browser. No server, no database. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var DEFAULT_REPO = 'SvenHammann90/ArenaShortStoriesViewer';
  var LS_TOKEN = 'ass-token';
  var LS_REPO = 'ass-repo';

  var state = {
    token: null,      /* the pasted personal access token */
    repo: null,       /* "owner/name" */
    branch: null,     /* default branch (Pages serves this) */
    index: null,      /* parsed stories/index.json */
    editingId: null   /* story id currently being edited, if any */
  };

  /* ---------- small helpers ---------- */

  function detectRepo() {
    try {
      var saved = localStorage.getItem(LS_REPO);
      if (saved) return saved;
    } catch (e) { /* private mode */ }
    var h = location.hostname;
    if (/(^|\.)github\.io$/.test(h)) {
      var owner = h.replace(/\.github\.io$/, '');
      var seg = location.pathname.split('/').filter(Boolean);
      if (seg.length && !/^index\.html?$|^admin\.html?$|^story\.html?$|^favicon/ig.test(seg[0])) {
        return owner + '/' + seg[0];
      }
      if (seg.length) return owner + '/' + seg[0].replace(/\.html?$/, '');
      return owner + '/' + owner + '.github.io';
    }
    return DEFAULT_REPO;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function friendly(e) {
    var msg = (e && e.message) || String(e);
    if (e && e.status === 401) {
      return 'GitHub rejected the token (401). It may have expired or been revoked — generate a fresh one.';
    }
    if (e && e.status === 403) {
      return /rate limit|secondary rate|abuse/i.test(msg)
        ? 'GitHub rate limit hit — wait a minute and try again.'
        : 'GitHub refused (403). The token probably lacks Contents → Read and write on this repository.';
    }
    if (e && e.status === 404) {
      return 'Not found (404). Check the repository — it should look like owner/name.';
    }
    return msg;
  }

  function gateStatus(msg, kind) {
    var el = $('#gateStatus');
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function formStatus(msg, kind) {
    var el = $('#formStatus');
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  /* ---------- GitHub API ---------- */

  function gh(path, opts) {
    opts = opts || {};
    return fetch('https://api.github.com/' + path, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + state.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (res.ok) return res.status === 204 ? null : res.json();
      return res.json().catch(function () { return {}; }).then(function (j) {
        var e = new Error(j.message || (res.status + ' ' + res.statusText));
        e.status = res.status;
        throw e;
      });
    });
  }

  /* Atomically commit several files in one commit (add, update or delete). */
  function commitFiles(files, message) {
    var api = 'repos/' + state.repo + '/';

    function attempt() {
      return gh(api + 'git/ref/heads/' + encodeURIComponent(state.branch)).then(function (ref) {
        var head = ref.object.sha;
        return gh(api + 'git/commits/' + head).then(function (commit) {
          var blobJobs = files
            .filter(function (f) { return !f.del; })
            .map(function (f) {
              return gh(api + 'git/blobs', { method: 'POST', body: { content: f.content, encoding: 'utf-8' } });
            });
          return Promise.all(blobJobs).then(function (blobs) {
            var bi = 0;
            var tree = files.map(function (f) {
              if (f.del) return { path: f.path, mode: '100644', type: 'blob', sha: null };
              return { path: f.path, mode: '100644', type: 'blob', sha: blobs[bi++].sha };
            });
            return gh(api + 'git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree: tree } });
          }).then(function (newTree) {
            return gh(api + 'git/commits', {
              method: 'POST',
              body: { message: message, tree: newTree.sha, parents: [head] }
            });
          }).then(function (newCommit) {
            return gh(api + 'git/refs/heads/' + encodeURIComponent(state.branch), {
              method: 'PATCH',
              body: { sha: newCommit.sha }
            });
          });
        });
      });
    }

    /* If someone else pushed in the meantime, the ref update conflicts — retry once. */
    return attempt().catch(function (e) {
      if (e && (e.status === 409 || e.status === 422)) return attempt();
      throw e;
    });
  }

  /* ---------- index / library ---------- */

  function findStory(id) {
    return (state.index && state.index.stories || []).filter(function (s) {
      return s.id === id;
    })[0] || null;
  }

  function indexJson(stories) {
    return JSON.stringify({ stories: ASS.sortStories(stories) }, null, 2) + '\n';
  }

  function loadIndex() {
    return gh('repos/' + state.repo + '/contents/stories/index.json?ref=' + encodeURIComponent(state.branch))
      .then(function (res) {
        var data = JSON.parse(ASS.b64ToUtf8(res.content));
        state.index = data && Array.isArray(data.stories) ? data : { stories: [] };
      }, function (e) {
        if (e && e.status === 404) { state.index = { stories: [] }; return; }
        state.index = { stories: [] };
        throw e;
      })
      .then(function () {
        renderLibrary();
      }, function (e) {
        renderLibrary();
        formStatus('The library could not be loaded: ' + friendly(e), 'err');
      });
  }

  function renderLibrary() {
    var box = $('#library');
    var list = ASS.sortStories(state.index && state.index.stories || []);
    $('#libCount').textContent = list.length ? '· ' + list.length + ' published' : '';

    if (!list.length) {
      box.innerHTML = '<p class="fine" style="margin:4px 0 0">Nothing published yet — the first story you ' +
        'publish will show up here, and on the public site a minute or two later.</p>';
      return;
    }

    box.innerHTML = list.map(function (s) {
      return (
        '<div class="lib-row" data-id="' + ASS.esc(s.id) + '">' +
          '<div class="lib-main">' +
            '<a class="lib-title" target="_blank" rel="noopener" href="story.html?id=' + encodeURIComponent(s.id) + '">' +
              ASS.esc(s.title || s.id) +
            '</a>' +
            '<span class="lib-meta">' + ASS.esc(s.model || '—') +
              ' · ' + ASS.esc(ASS.fmtDate(s.date)) +
              ' · ' + (s.words || 0) + ' words</span>' +
          '</div>' +
          '<div class="lib-actions">' +
            '<button type="button" class="lib-btn" data-act="edit">Edit</button>' +
            '<button type="button" class="lib-btn danger" data-act="del">Delete</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  $('#library').addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var row = ev.target.closest('.lib-row');
    if (!row) return;
    var id = row.dataset.id;
    var act = btn.dataset.act;

    if (act === 'edit') {
      editStory(id);
    } else if (act === 'del') {
      row.querySelector('.lib-actions').innerHTML =
        '<span class="confirm-note">Remove?</span>' +
        '<button type="button" class="lib-btn danger" data-act="del-yes">Yes</button>' +
        '<button type="button" class="lib-btn" data-act="del-no">No</button>';
    } else if (act === 'del-no') {
      renderLibrary();
    } else if (act === 'del-yes') {
      deleteStory(id, row);
    }
  });

  /* ---------- form ---------- */

  function updateStats() {
    var n = ASS.words($('#fStory').value);
    $('#storyStats').textContent = n
      ? n.toLocaleString('en-US') + ' words · about ' + ASS.readMins(n) + ' min read'
      : '';
  }

  function resetForm() {
    $('#storyForm').reset();
    state.editingId = null;
    $('#editBanner').hidden = true;
    $('#formHeadLabel').textContent = 'Publish a story';
    $('#publishBtn').textContent = 'Publish story';
    $('#fDate').value = todayISO();
    $('#formStatus').textContent = '';
    $('#formStatus').className = 'status';
    updateStats();
  }

  function editStory(id) {
    formStatus('Loading story…');
    gh('repos/' + state.repo + '/contents/stories/' + encodeURIComponent(id) +
       '.json?ref=' + encodeURIComponent(state.branch))
      .then(function (res) {
        var s = JSON.parse(ASS.b64ToUtf8(res.content));
        $('#fTitle').value = s.title || '';
        $('#fModel').value = s.model || '';
        $('#fDate').value = s.date || todayISO();
        $('#fPrompt').value = s.prompt || '';
        $('#fStory').value = s.story || '';
        state.editingId = id;
        $('#editBanner').hidden = false;
        $('#editBanner .banner-text').textContent =
          'Editing “' + (s.title || id) + '” — saving overwrites the published story.';
        $('#formHeadLabel').textContent = 'Edit an existing story';
        $('#publishBtn').textContent = 'Save changes';
        formStatus('');
        updateStats();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        $('#fTitle').focus();
      })
      .catch(function (e) {
        formStatus(friendly(e), 'err');
      });
  }

  function deleteStory(id, row) {
    var entry = findStory(id);
    if (!entry) return;
    row.querySelector('.lib-actions').innerHTML = '<span class="confirm-note">Removing…</span>';

    var stories = (state.index.stories || []).filter(function (s) { return s.id !== id; });

    commitFiles([
      { path: 'stories/' + id + '.json', del: true },
      { path: 'stories/index.json', content: indexJson(stories) }
    ], 'Remove story: “' + (entry.title || id) + '”')
      .then(function () {
        state.index = { stories: stories };
        if (state.editingId === id) resetForm();
        renderLibrary();
        formStatus('Removed “' + (entry.title || id) + '”.', 'ok');
      })
      .catch(function (e) {
        formStatus(friendly(e), 'err');
        renderLibrary();
      });
  }

  function publish(ev) {
    ev.preventDefault();
    if (!state.index) {
      formStatus('Still loading the library — try again in a moment.', 'err');
      return;
    }

    var title = $('#fTitle').value.trim();
    var model = $('#fModel').value.trim();
    var date = $('#fDate').value || todayISO();
    var prompt = $('#fPrompt').value.replace(/\r\n/g, '\n').trim();
    var story = $('#fStory').value.replace(/\r\n/g, '\n').trim();

    if (!title) return formStatus('Give the story a title.', 'err');
    if (!model) return formStatus('Which model wrote it? Use the name as shown on Arena.', 'err');
    if (!story) return formStatus('Paste the story text.', 'err');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return formStatus('The date looks invalid.', 'err');

    var wordCount = ASS.words(story);
    var now = new Date().toISOString();
    var editing = state.editingId;
    var existing = editing ? findStory(editing) : null;

    var id;
    if (editing) {
      id = editing;
    } else {
      id = date + '-' + (ASS.slugify(title) || 'untitled');
      var base = id, n = 2;
      while (findStory(id)) id = base + '-' + n++;
    }

    var entry = {
      id: id,
      title: title,
      model: model,
      date: date,
      words: wordCount,
      prompt: prompt,
      addedAt: existing ? existing.addedAt : now
    };
    var record = Object.assign({}, entry, { story: story, updatedAt: now });

    var stories = (state.index.stories || [])
      .filter(function (s) { return s.id !== id; })
      .concat([entry]);

    var btn = $('#publishBtn');
    btn.disabled = true;
    btn.textContent = editing ? 'Saving…' : 'Publishing…';
    formStatus(editing ? 'Saving changes…' : 'Publishing to GitHub…');

    commitFiles([
      { path: 'stories/' + id + '.json', content: JSON.stringify(record, null, 2) + '\n' },
      { path: 'stories/index.json', content: indexJson(stories) }
    ], (editing ? 'Edit story: ' : 'Add story: ') + '“' + title + '” (' + model + ')')
      .then(function () {
        state.index = { stories: stories };
        renderLibrary();
        resetForm();

        var el = $('#formStatus');
        el.className = 'status ok';
        el.textContent = 'Published. ';
        var a = document.createElement('a');
        a.href = 'story.html?id=' + encodeURIComponent(id);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'View it';
        el.appendChild(a);
        el.appendChild(document.createTextNode(
          ' — it appears on the public site within a few minutes, once GitHub Pages rebuilds.'));
      })
      .catch(function (e) {
        formStatus(friendly(e), 'err');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = state.editingId ? 'Save changes' : 'Publish story';
      });
  }

  function preview() {
    var obj = {
      title: $('#fTitle').value.trim() || 'Untitled',
      model: $('#fModel').value.trim(),
      date: $('#fDate').value || todayISO(),
      prompt: $('#fPrompt').value,
      story: $('#fStory').value,
      words: ASS.words($('#fStory').value)
    };
    if (!obj.story.trim() && !obj.prompt.trim()) {
      formStatus('Nothing to preview yet — add at least a prompt or a story.', 'err');
      return;
    }
    formStatus('');
    $('#previewBody').innerHTML = ASS.storyArticle(obj, { copyLink: false });
    $('#previewPanel').hidden = false;
    $('#previewPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- unlock / lock ---------- */

  function enterStudio(who) {
    $('#gate').hidden = true;
    $('#studio').hidden = false;
    $('#whoami').textContent =
      'Unlocked as ' + who + ' · ' + state.repo + ' · branch ' + state.branch;
  }

  function tryUnlock(token, repo) {
    state.token = token;
    state.repo = repo;
    return gh('repos/' + repo).then(function (info) {
      if (!info || !info.default_branch) {
        var nf = new Error('Repository “' + repo + '” was not found.');
        nf.status = 404;
        throw nf;
      }
      if (!info.permissions || !info.permissions.push) {
        var pe = new Error('This token can read “' + repo + '” but not write to it. ' +
          'Give it Contents → Read and write, then try again.');
        pe.status = 403;
        throw pe;
      }
      state.branch = info.default_branch;
      return gh('user')
        .then(function (u) { return u && u.login ? u.login : info.owner.login; },
               function () { return info.owner.login; })
        .then(function (who) {
          try {
            localStorage.setItem(LS_TOKEN, token);
            localStorage.setItem(LS_REPO, repo);
          } catch (e) { /* private mode */ }
          enterStudio('@' + who);
          return loadIndex();
        });
    });
  }

  function unlock() {
    var repo = ($('#repoInput').value || '')
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/, '')
      .replace(/\/+$/, '');
    var token = ($('#tokenInput').value || '').trim();

    if (!repo || !token) {
      gateStatus('Fill in both the repository and the token.', 'err');
      return;
    }

    gateStatus('Checking the token…');
    var btn = $('#unlockBtn');
    btn.disabled = true;

    tryUnlock(token, repo).then(function () {
      btn.disabled = false;
    }, function (e) {
      btn.disabled = false;
      state.token = null;
      state.repo = null;
      try { localStorage.removeItem(LS_TOKEN); } catch (e2) { /* noop */ }
      gateStatus(friendly(e), 'err');
    });
  }

  function lock() {
    state.token = null;
    state.repo = null;
    state.branch = null;
    state.index = null;
    state.editingId = null;
    try { localStorage.removeItem(LS_TOKEN); } catch (e) { /* noop */ }
    $('#studio').hidden = true;
    $('#gate').hidden = false;
    $('#tokenInput').value = '';
    gateStatus('Locked. The token was removed from this browser.', 'ok');
  }

  /* ---------- wiring ---------- */

  $('#unlockBtn').addEventListener('click', unlock);
  $('#tokenInput').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') unlock();
  });
  $('#repoInput').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') unlock();
  });
  $('#lockBtn').addEventListener('click', lock);

  $('#storyForm').addEventListener('submit', publish);
  $('#previewBtn').addEventListener('click', preview);
  $('#closePreviewBtn').addEventListener('click', function () {
    $('#previewPanel').hidden = true;
  });
  $('#cancelEditBtn').addEventListener('click', function (ev) {
    ev.preventDefault();
    resetForm();
  });
  $('#fStory').addEventListener('input', updateStats);

  /* ---------- boot ---------- */

  var repo = detectRepo();
  $('#repoInput').value = repo;
  $$('.repoName').forEach(function (el) { el.textContent = repo; });
  $('#fDate').value = todayISO();
  updateStats();

  var savedToken = null;
  try { savedToken = localStorage.getItem(LS_TOKEN); } catch (e) { /* noop */ }

  if (savedToken) {
    tryUnlock(savedToken, repo).catch(function () {
      try { localStorage.removeItem(LS_TOKEN); } catch (e) { /* noop */ }
      gateStatus('The saved token no longer works — paste a fresh one to continue.', 'err');
    });
  }
})();
