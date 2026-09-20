# Arena Short Stories

A small, dependency-free website for reading the best AI-generated short stories to come out of
single-prompt experiments on [Arena.AI](https://arena.ai). Every story is published together with
the exact prompt that produced it and the name of the model that wrote it.

- **Public site** (read-only): the list of stories — newest first, grouped by month, with search
  and model filters — and a comfortable, typography-first reading page.
- **Curator studio** (`/admin.html`): a private page where the curator publishes, edits, and
  removes stories. No server, no database — just GitHub.

## How it works

Everything is static and hosted for free on GitHub Pages:

```
index.html      public list of stories (newest first)
story.html      the reading page for one story (?id=…)
admin.html      curator studio (protected by a GitHub access token)
assets/         styles and scripts — no frameworks, no build step
stories/
  index.json    catalogue of all stories (metadata only)
  <id>.json     one file per story (prompt, model, full text)
```

Publishing a story from the studio commits two JSON files to the default branch in a single
commit; GitHub Pages then rebuilds the site automatically (usually within a minute or two).

## Reading

- Stories are listed newest first and grouped by month.
- Search matches titles, prompts, and model names; the chips filter by model.
- Each story page shows the model, the date, a reading-time estimate, the full prompt, and the
  story itself — with a link back to newer/older stories.
- Light and dark themes are both built in; the choice is remembered.

## Publishing stories (curator)

1. Open the site’s `/admin.html` (there is a “Curator studio” link in the footer of every page).
2. Create a **fine-grained personal access token**:
   GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token*.
   - **Repository access:** *Only select repositories* → this repository.
   - **Permissions:** *Contents* → **Read and write**. Nothing else is needed.
   - A classic token with the `repo` scope works too.
3. Paste the token into the studio and unlock. The token is stored only in your browser’s local
   storage and is sent only to `api.github.com`. Lock the studio or revoke the token any time.
4. Fill in the title, the model (as shown on Arena), the date, the prompt, and the story text.
   Use **Preview** to see exactly how it will read.
5. **Publish story** commits the story to the site’s branch; the public site updates when
   GitHub Pages finishes rebuilding.

The studio can also edit or delete any published story — both are ordinary commits to the same
files. Model suggestions in the form are a plain `<datalist>`; type any name you like.

### Story file format

Each story lives at `stories/<id>.json`:

```json
{
  "id": "2026-09-20-the-lighthouse",
  "title": "The Lighthouse",
  "model": "Claude Sonnet 4.5",
  "date": "2026-09-20",
  "prompt": "Write a short story about …",
  "story": "Full text, paragraphs separated by blank lines…",
  "words": 812,
  "addedAt": "2026-09-20T18:42:00.000Z",
  "updatedAt": "2026-09-21T09:10:00.000Z"
}
```

and is catalogued in `stories/index.json` (same fields, minus the story text, so the front page
stays light). You can also add stories by hand with a normal commit — just keep both files in
sync (the studio does this automatically).

Simple markdown inside prompts and stories is rendered: blank-line paragraphs, `#`–`###`
headings, **bold**, *italic*, `` `code` ``, `>` blockquotes, and `---` dividers.

## Local preview

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Customising

- Colours, fonts, and spacing are CSS custom properties at the top of
  `assets/css/style.css` (light and dark themes both).
- The site name appears in `index.html`, `story.html`, `admin.html`, and the footer.

## Notes

- GitHub Pages caches files for about ten minutes; a freshly published story can take a couple
  of minutes to appear.
- The studio works from any browser; it only needs a token that can write to this repository.
- The site is intentionally dependency-free: no frameworks, no build step, no tracking.
