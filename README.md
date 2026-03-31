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
- Frontend: `http://localhost:5173`

When everything is running, the dashboard should display the API health response.

## Demo Login

- Email: `admin@resumex.com`
- Password: `Admin@123`
