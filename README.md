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
├── docker-compose.yml  .env.example  README.md
├── backend/
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
│           └── analysis.py  # STUBS: /api/analyze, /result/{id}, /history, /feedback
├── ml/
│   ├── predict.py           # ML teammate implements predict(text)
│   └── README.md
└── frontend/
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
| POST | /api/analyze | `{text}` | analysis object ↓ |
| GET | /api/result/{id} | – | analysis object |
| GET | /api/history | – | `[{id,label,confidence,snippet,created_at}]` |
| POST | /api/feedback | `{analysis_id, correct, comment?}` | `{ok, id}` |

Analysis object (**currently a stub — TODO: replace with real ML**):
```json
{"id":17,"label":"FAKE","confidence":0.937,
 "models":[{"name":"BERT","label":"FAKE","confidence":0.95}],
 "words":[{"word":"miracle","score":0.842}],
 "shap":[{"feature":"Exclamation Count","value":1.283}]}
```
`label` is one of `REAL | FAKE | UNCERTAIN`.

## Notes
- Tables are created on startup; add Alembic once the schema settles.
- The login rate limiter is in memory (per process); switch to Redis for multiple instances.
- Logout is client-side (stateless JWT); the frontend also auto-logs-out when the token expires or any request returns 401.
