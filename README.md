# school-gpt

School management application built as a Laravel REST API and a separate React frontend.

## Current milestone: project setup

The Laravel 13 API lives in `backend/`; the React 19 app lives in `frontend/`. The React dev server proxies `/api` requests to Laravel. SQLite is configured for local development so the first slice works without a running MySQL server.

### Install dependencies once

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate

cd ../frontend
npm install
```

### Run the API

```sh
cd backend
php artisan serve
```

The health endpoint is [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health). It returns `status: ok` when the configured database can be reached.

### Run the frontend

In another terminal:

```sh
cd frontend
npm run dev
```

Open the URL printed by Vite. The page shows whether the API and database are connected.

### Verify this milestone

```sh
cd backend && php artisan test
cd frontend && npm test
cd frontend && npm run build
```

The backend feature test checks the health response against an in-memory SQLite database. The React tests cover the connected and API-unavailable states. The build checks that Vite can compile the frontend for production.
# school-gpt
