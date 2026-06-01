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

Start MySQL, create the database schema, then run the API and Flutter app.

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
