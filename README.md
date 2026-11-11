# school-gpt

School management app built as a Laravel REST API and a separate React frontend.

## Progress

- [x] Project setup, health check, SQLite connection, and React page
- [x] Cookie sign-in, role membership, school access checks
- [x] Schools and school user management
- [x] Academic structure: school-specific grades, sections, subjects, and their assignments
- [x] Student records, class enrollment, and enrollment history
- [x] Daily class attendance registers
- [x] School fee items, student invoices, and payments

## Setup once

The Laravel 13 API is in `backend/`; the React 19 app is in `frontend/`. SQLite keeps local development independent of a running MySQL server. The React dev server proxies API and CSRF-cookie requests to Laravel.

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan school:create-super-admin
```

The console command asks for an email, name, and password without echoing the password. It creates a global admin; public self-registration is disabled.
To provision an ordinary teacher or school-admin account for later assignment, run `php artisan school:create-user`. It creates the account without granting any role or school access.

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

And start the API in a separate terminal:

```sh
cd backend
php artisan serve
```

Open the Vite URL. Sign in with the global administrator credentials you created. The health endpoint is [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).

## Verify

```sh
(cd backend && php artisan test)
(cd frontend && npm test)
(cd frontend && npm run build)
(cd frontend && npm run lint)
```

Backend tests cover login/logout, school CRUD and archiving, school-member management, role restrictions, tenant isolation, account provisioning, and the database health endpoint. React tests cover sign-in, school creation, and adding a member to a school.

School admins can add grades and sections from a school card's academic structure panel, assign active sections to each grade, then add subjects and assign them to active grades. Teachers can view the structure. No default academic names are seeded because each school defines its own structure.

School admins can add, edit, archive, and restore student records, enroll or move students through the roster, and filter the roster by academic year. Each move closes the previous enrollment while retaining its history.

School admins and teachers can open **Take attendance** from the roster, select a class and date, and mark each enrolled student present, absent, late, or excused. Daily marks can be edited later and are unique per enrollment and date.

School admins can use **Manage fees** to define year-specific fee items, edit or restore archived items, issue student invoices, record partial payments, and review balances and payment history. The invoiced amount is preserved if the fee schedule changes later, and an invoice with payments cannot be voided.
