# Khilkhet Delivery Service (KDS)

KDS is a Flutter MVP for a hyperlocal food delivery service in Khilkhet, Dhaka.

## Current Scope

- Phone/password sign in and sign up
- Customer food delivery home
- Nearby restaurant browsing
- Restaurant menu and cart
- Checkout with fixed delivery fee
- Order tracking timeline
- Favorites, offers, and search UI
- Single admin dashboard preview
- Restaurant, order, rider, promo, and financial summary widgets

## Run

Start MySQL, create the database schema, then run the API and either the Flutter app or the React web frontend.

```bash
cd /home/sujon/kds-app
mysql -u root -p < backend/sql/schema.sql
cd backend
cp .env.example .env
npm install
npm run dev
```

For an existing KDS database created before password login:

```bash
mysql -u root -p < backend/sql/2026_06_01_password_auth.sql
```

In another terminal:

```bash
cd kds-app
flutter pub get
flutter run --dart-define=KDS_API_BASE_URL=http://127.0.0.1:4000
```

For web build:

```bash
flutter build web --dart-define=KDS_API_BASE_URL=http://127.0.0.1:4000
```

## React Web Frontend

A separate React web frontend is available in [`frontend/`](/home/sujon/kds-app/frontend).

Run it locally:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

For local development, make sure the backend is running on `http://127.0.0.1:4000`.

For production builds:

```bash
cd frontend
npm run build
```

For production on `kdeasylife.com`, set the frontend API URL in [`frontend/.env.production`](/home/sujon/kds-app/frontend/.env.production):

```env
VITE_API_BASE_URL=https://api.kdeasylife.com
```

On the backend, make sure CORS allows the frontend origin in [`backend/.env`](/home/sujon/kds-app/backend/.env):

```env
CORS_ORIGINS=https://kdeasylife.com,https://www.kdeasylife.com,http://kdeasylife.com,http://www.kdeasylife.com
```

## Deploy

For AWS deployment, use the EC2/RDS guide in [DEPLOY_AWS.md](/home/sujon/kds-app/DEPLOY_AWS.md).

For cPanel/Passenger hosting, make sure the startup file is [`backend/app.js`](/home/sujon/kds-app/backend/app.js). That file loads [`backend/src/server.js`](/home/sujon/kds-app/backend/src/server.js) using ES modules, which matches the backend `package.json`.

## Login

- Users do not choose a role in the app.
- Role comes from the `users` table after sign in.
- New customers use `Sign up`; existing users use `Sign in`.
- The schema seeds one admin: `01700000000`.
- Demo admin login: `01700000000` / `admin123`.

## Brand

- Primary: Yellow
- Secondary: Red-orange
- Layout: mobile-first, rounded controls, clean Foodpanda-inspired flow
