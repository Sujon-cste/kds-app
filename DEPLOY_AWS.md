# Deploy KDS on AWS

This project is already structured for a simple AWS deployment:

- Flutter web build for the customer/admin UI
- Node/Express backend on port `4000`
- MySQL database for app data
- Nginx as the public web server and reverse proxy

The fastest path on AWS is:

1. `EC2` for the app server
2. `RDS MySQL` for the database, or local MySQL on the same EC2 instance if you want the cheapest setup
3. `Nginx` on EC2 to serve Flutter web and proxy `/api` to the backend

## Recommended AWS Layout

- `EC2 Ubuntu 22.04`
- `RDS MySQL 8`
- `Security Group` allowing `22` from your IP, `80` and `443` from the internet
- `ALB` only if you want managed HTTPS with ACM

If you want the simplest first deployment, skip `RDS` and use MySQL locally on the EC2 instance. The repo already supports that.

## 1. Create The EC2 Instance

Use Ubuntu 22.04 or newer. A small instance is enough for this MVP.

Open these inbound ports:

- `22` SSH from your IP
- `80` HTTP from anywhere
- `443` HTTPS from anywhere if you plan to enable SSL

Do not expose MySQL publicly.

## 2. Install System Packages

SSH into the instance:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Install packages:

```bash
sudo apt update
sudo apt install -y git nginx curl unzip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

If you are using local MySQL on EC2:

```bash
sudo apt install -y mysql-server
```

Install Flutter so the web build can run on the server:

```bash
sudo mkdir -p /opt/flutter
sudo chown ubuntu:ubuntu /opt/flutter
git clone https://github.com/flutter/flutter.git -b stable /opt/flutter
echo 'export PATH="$PATH:/opt/flutter/bin"' >> ~/.bashrc
source ~/.bashrc
flutter config --enable-web
flutter doctor
```

## 3. Clone The Repo

```bash
sudo mkdir -p /opt/kds-app
sudo chown ubuntu:ubuntu /opt/kds-app
git clone https://github.com/Sujon-cste/kds-app.git /opt/kds-app
cd /opt/kds-app
```

## 4. Configure The Database

### Option A: Local MySQL On EC2

Create the database user and import the schema:

```bash
sudo mysql < backend/sql/create_kds_user.sql
mysql -u kds -p kds_app < backend/sql/schema.sql
```

### Option B: AWS RDS MySQL

Create an RDS MySQL instance and note the endpoint, username, password, and database name.

Then import the schema from the EC2 instance:

```bash
mysql -h YOUR_RDS_ENDPOINT -P 3306 -u YOUR_RDS_USER -p YOUR_RDS_DB < backend/sql/schema.sql
```

In the RDS security group, allow inbound port `3306` only from the EC2 security group.

## 5. Configure Backend Environment

```bash
cd /opt/kds-app/backend
cp .env.example .env
nano .env
```

Set production values:

```bash
PORT=4000
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=kds
MYSQL_PASSWORD=your-db-password
MYSQL_DATABASE=kds_app
JWT_SECRET=use-a-long-random-secret
ADMIN_PHONE=01700000000
ADMIN_NAME=KDS Super Admin
ADMIN_PASSWORD=your-admin-password
```

If you are using RDS, set `MYSQL_HOST` to the RDS endpoint and use the RDS username/password.

Install backend dependencies:

```bash
npm install --omit=dev
```

## 6. Start The Backend With systemd

```bash
sudo cp /opt/kds-app/deploy/ec2/kds-backend.service /etc/systemd/system/kds-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now kds-backend
sudo systemctl status kds-backend
```

Health check:

```bash
curl http://127.0.0.1:4000/health
```

## 7. Build Flutter Web

The web build must point to the API through Nginx:

```bash
cd /opt/kds-app
flutter pub get
TZ=UTC flutter build web --no-wasm-dry-run --dart-define=KDS_API_BASE_URL=/api
```

Deploy the generated static files:

```bash
sudo mkdir -p /var/www/kds-app
sudo rsync -a --delete build/web/ /var/www/kds-app/
```

## 8. Configure Nginx

```bash
sudo cp /opt/kds-app/deploy/ec2/kds-nginx.conf /etc/nginx/sites-available/kds-app
sudo ln -sf /etc/nginx/sites-available/kds-app /etc/nginx/sites-enabled/kds-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Open the site:

```text
http://YOUR_EC2_PUBLIC_IP
```

## 9. Optional HTTPS

If you attach a domain directly to EC2, use Certbot for a Let’s Encrypt certificate.

If you want managed certificates, place an Application Load Balancer in front of EC2 and use ACM there.

## Redeploy

After code changes:

```bash
cd /opt/kds-app
git pull
cd backend
npm install --omit=dev
sudo systemctl restart kds-backend
cd ..
TZ=UTC flutter build web --no-wasm-dry-run --dart-define=KDS_API_BASE_URL=/api
sudo rsync -a --delete build/web/ /var/www/kds-app/
sudo systemctl reload nginx
```

## Troubleshooting

- Backend logs: `sudo journalctl -u kds-backend -f`
- Backend restart: `sudo systemctl restart kds-backend`
- Nginx config test: `sudo nginx -t`
- If login fails, verify `JWT_SECRET`, `MYSQL_PASSWORD`, and the imported schema
- If the web app cannot reach the API, confirm the build used `--dart-define=KDS_API_BASE_URL=/api`
