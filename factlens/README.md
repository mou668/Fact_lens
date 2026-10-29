# FactLens — Explainable Fake News Detection (foundation)

Auth, app shell and **stubbed** API. The real ML and analysis are not built yet (TODOs below).

## Run it
```bash
cp .env.example .env          # set a unique JWT_SECRET and ADMIN_PASSWORD
docker compose up --build
```
- Frontend: http://localhost:5173
- API + Swagger docs: http://localhost:8000/docs
- Seeded admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`

Without Docker: start Postgres, set `DATABASE_URL` to `localhost`, then
`cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload` and
`cd frontend && npm install && npm run dev`.

## Folder map
```
factlens/
├ docker-compose.yml  .env.example  README.md
├ backend/
│   ├── Dockerfile  requirements.txt
│   └── app/
│       ├── main.py          # app, CORS, validation errors, table creation, admin seed
│       ├── config.py        # settings from .env
│       ├── database.py      # SQLAlchemy engine/session
│       ├── models.py        # User (role: user|admin), Analysis, Feedback
│       ├── schemas.py       # Pydantic request/response + validation
│       ├── security.py      # bcrypt + JWT
│       ├── deps.py          # get_current_user, require_admin
│       ├── rate_limit.py    # login attempt limiter
│       └── routers/
│           ├── auth.py      # /api/auth/register|login|logout|me
│           └── analysis.py  # /api/analyze, upload/URL analysis, /result/{id}, /history, /feedback
├ ml/
│   ├── predict.py           # ML teammate implements predict(text)
│   └── README.md
└ frontend/
    ├── Dockerfile  package.json  vite.config.js  tailwind.config.js  index.html
    └── src/
        ├── main.jsx  App.jsx (routes)  index.css
        ├── api/client.js            # ONLY file that calls the API
        ├── context/AuthContext.jsx  ThemeContext.jsx
        ├── components/  Layout Sidebar TopBar ProtectedRoute ComingSoon PasswordInput AuthShell
        └── pages/  Login Register Analyze Result History Models About Help
```

## Who owns what
| Area | Owner |
|---|---|
| `ml/`, `run_model()` in `backend/app/routers/analysis.py`, Models page | ML teammate |
| Analyze, Result, History, About, Help pages | Frontend teammate |

## Colours (tailwind.config.js)
`real` #16A34A · `fake` #DC2626 · `uncertain` #F59E0B · `primary` #2563EB · `navy` sidebar.
Badges: `className="badge-FAKE"` etc.

## Add a new page
1. Create `frontend/src/pages/Reports.jsx`.
2. Add `<Route path="/reports" element={<Reports />} />` inside the protected block in `App.jsx`.
3. Add `{ to: "/reports", label: "Reports", icon: SomeIcon }` to `NAV` in `components/Sidebar.jsx`.

## Add a new endpoint
1. Add the route to a router in `backend/app/routers/` (or make a new file and `app.include_router(...)` in `main.py`).
2. Protect it with `user: User = Depends(get_current_user)` (or `require_admin`).
3. Add a schema to `schemas.py` if it takes a body.
4. Add a function to `api` in `frontend/src/api/client.js` and call it from pages.

## API contract
All analysis endpoints need `Authorization: Bearer <token>`. Errors: `{"detail": "...", "errors": {field: msg}}`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/auth/register | `{name,email,password}` | `{access_token, token_type, expires_in, user}` |
| POST | /api/auth/login | `{email,password}` | same (429 after too many failures) |
| POST | /api/auth/logout | – | 204 |
| GET | /api/auth/me | – | `{id,name,email,role}` |
| POST | /api/analyze | `{input_type, text?, url?, image_base64?}` | analysis object ↓ |
| POST | /api/analyze-file | multipart `file` (.txt/.pdf/.docx) | analysis object ↓ |
| POST | /api/analyze-url | `{url}` | analysis object with source URL metadata |
| GET | /api/result/{id} | – | analysis object |
| GET | /api/history | `q`, `label`, `offset`, `limit` query parameters | `{items,total,offset,limit}` |
| DELETE | /api/history/{id} | – | 204 |
| POST | /api/feedback | `{analysis_id, correct, comment?}` | `{ok, id}` |

Analysis object (real ML pipeline):
```json
{
  "id": 17,
  "label": "FAKE",
  "confidence": 0.937,
  "low_confidence": false,
  "models": [{"name": "BERT", "label": "FAKE", "confidence": 0.95}],
  "words": [{"word": "miracle", "score": 0.842}],
  "shap": [{"feature": "Exclamation Count", "value": 1.283}],
  "claims": [],
  "source_domain": null,
  "source_credibility_badge": null
}
```
`label` is one of `REAL | FAKE | UNCERTAIN`.
`low_confidence` is `true` when confidence is under 65%.
`source_domain` is the article's domain (for URL input).
`source_credibility_badge` indicates HTTPS security and trusted/unreliable source list.

Uploads are limited to 5 MB and 100 PDF pages; extracted text must fit the
20,000-character analysis limit. URL analysis accepts public HTTP/HTTPS article
pages only, redirects and private/non-public hosts, and limits fetched
responses to 1 MB. URL badges indicate HTTPS transport and explicitly do not
assert publisher reputation.

### /api/analyze input types

- `input_type: "text"` (default): `text` field required, analyzed directly.
- `input_type: "url"`: `url` field required; page is fetched and article body extracted
  via `trafilatura`. Returns `source_domain` and `source_credibility_badge`:
  - `Trusted source (HTTPS)` for known trusted outlets over HTTPS
  - `HTTPS connection` for secure but unrecognized sources
  - `Non-secure connection` for HTTP URLs
- `input_type: "image"`: `image_base64` field required; Tesseract OCR extracts text.
  The frontend typically uses `/api/extract-image-text` first, then passes the
  extracted text to `/api/analyze` for analysis.

### /api/analyze output

- `low_confidence`: `true` when the ensemble confidence is under 65%, `false` otherwise.
- When `low_confidence` is `true`, the UI should display a warning.
- `source_domain` and `source_credibility_badge` are `null` for text input.

Fact-check lookup and claim extraction remain as documented previously.

## Feature notes: fact-check lookup and claim extraction

- Set `GOOGLE_FACT_CHECK_API_KEY` in `.env` to enable `POST /api/factcheck`.
  The endpoint returns up to ten matching claim reviews with rating, publisher, and link.
- A `spaCy` sentence split and checkable-statement filter adds a `claims` array
  to analysis responses. Install ML dependencies with
  `pip install -r ml/requirements.txt` before running the pipeline.

## Feature notes: model comparison and AI-generated text

- The Models page reads `ml/metrics.json` for measured accuracy, precision,
  recall, F1, confusion matrices, ROC-AUC, and saved ROC points. It does not
  synthesize metric values.
- Retrain with a real dataset before replacing metrics. For optional 2020+
  CSV data, set `FACTLENS_NEW_DATA_CSV` and run the training command in
  `ml/README.md`.
- `/api/analyze` adds `ai_generated_probability` (0-1). This is an
  explainable prose-style estimate, not a definitive authorship result.

## Phase 1: Three input types, one pipeline
POST /api/analyze now accepts `text`, `url`, or `image` via the `input_type` discriminator.
- URL: fetches the page, extracts the article body with trafilatura, returns the
  title, source domain, and a source-credibility badge (HTTPS, trusted/unreliable list).
- Image: Tesseract OCR extracts the text (via `/api/extract-image-text`); the user
  can correct it before analyzing.
- All three go through the same preprocessing and ensemble.
- Always returns REAL or FAKE plus confidence, and `low_confidence: true` when
  confidence is under 65%.



## Phase 2: Live evidence check
- Extract the main claims from the article via `extract_checkable_claims`
- Query the Google Fact Check Tools API (when `GOOGLE_FACT_CHECK_API_KEY` is set in `.env`) and a news search API
- Return `"evidence": [{source, title, link, rating_or_stance}]` on the Result page next to the verdict
- If trusted outlets or fact-checkers contradict the claim, show a clear warning
- The backend gracefully handles missing API keys (evidence array is empty, not an error)

### /api/analyze output updates
- `claims`: list of checkable statements extracted from the article
- `evidence`: live fact-check evidence from configured APIs

### Frontend Result page
- Updated `Live evidence check` section displays evidence cards with source, title, link, and stance
- Shows warning when no evidence is available and API key is not configured

## Notes
- Tables are created on startup; add Alembic once the schema settles.
- The login rate limiter is in memory (per process); switch to Redis for multiple instances.
- Logout is client-side (stateless JWT); the frontend also auto-logs-out when the token expires or any request returns 401.