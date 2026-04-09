# Resume Screening Dashboard

Module 1 sets up the college-level project foundation using `React + Vite`, `FastAPI`, and `MongoDB`.

Module 2 adds `JWT authentication`, a `seeded demo admin user`, a `login page`, and `protected frontend routes`.
It now also includes a simple `signup flow` for creating new users in the college-level MVP.

## Project Structure

```text
frontend/   React UI shell and API client
backend/    FastAPI app, config, MongoDB connection, health route
```

## Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

## Health Check

- Backend root: `http://localhost:8000/`
- API health: `http://localhost:8000/api/v1/health`
- Frontend: `http://localhost:8080`

When everything is running, the dashboard should display the API health response.

## Troubleshooting

- `ERR_CONNECTION_REFUSED` for `http://localhost:8080` means the Vite frontend server is not running. Check [frontend/vite.config.ts](/D:/AI-Based-Resume-Screening-and-Analytics-Dashboard/frontend/vite.config.ts).
- `ERR_CONNECTION_REFUSED` for `http://127.0.0.1:8000/api/v1/auth/login` means the FastAPI backend is not running. Check [frontend/src/lib/api.ts](/D:/AI-Based-Resume-Screening-and-Analytics-Dashboard/frontend/src/lib/api.ts) for the API URL and start the backend from the `backend/` folder.
- If the backend starts but the browser blocks requests, verify `FRONTEND_ORIGIN` in [backend/.env](/D:/AI-Based-Resume-Screening-and-Analytics-Dashboard/backend/.env).

## Demo Login

- Email: `admin@resumex.com`
- Password: `Admin@123`
