# Deploy KDS on EC2

This deploys Flutter web through Nginx and the Node backend through systemd.

## 1. EC2 Security Group

Open these inbound ports:

- `22` SSH from your IP
- `80` HTTP from anywhere
- `443` HTTPS from anywhere, if you add SSL later

Do not open MySQL port `3306` publicly.

## 2. Install Server Packages

SSH into the EC2 instance:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Install packages:

```bash
sudo apt update
sudo apt install -y git nginx mysql-server curl unzip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install Flutter:

```bash
sudo mkdir -p /opt/flutter
sudo chown ubuntu:ubuntu /opt/flutter
git clone https://github.com/flutter/flutter.git -b stable /opt/flutter
echo 'export PATH="$PATH:/opt/flutter/bin"' >> ~/.bashrc
source ~/.bashrc
flutter config --enable-web
flutter doctor
```

## 3. Clone App

```bash
sudo mkdir -p /opt/kds-app
sudo chown ubuntu:ubuntu /opt/kds-app
git clone https://github.com/Sujon-cste/kds-app.git /opt/kds-app
cd /opt/kds-app
```

## 4. Configure MySQL

Create database and app user:

```bash
sudo mysql < backend/sql/create_kds_user.sql
mysql -u kds -p kds_app < backend/sql/schema.sql
```

Use the password from the SQL file when prompted unless you changed it.

## 5. Configure Backend Environment

```bash
cd /opt/kds-app/backend
cp .env.example .env
nano .env
```

Set production values:

```bash
MYSQL_PASSWORD=your-db-password
JWT_SECRET=use-a-long-random-secret
ADMIN_PASSWORD=your-admin-password
```

Install backend dependencies:

```bash
npm install --omit=dev
```

## 6. Start Backend With systemd

```bash
sudo cp /opt/kds-app/deploy/ec2/kds-backend.service /etc/systemd/system/kds-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now kds-backend
sudo systemctl status kds-backend
```

Check backend:

```bash
curl http://127.0.0.1:4000/health
```

## 7. Build Flutter Web

```bash
cd /opt/kds-app
flutter pub get
TZ=UTC flutter build web --no-wasm-dry-run --dart-define=KDS_API_BASE_URL=/api
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

Open:

```text
http://YOUR_EC2_PUBLIC_IP
```

## Useful Commands

Backend logs:

```bash
sudo journalctl -u kds-backend -f
```

Restart backend:

```bash
sudo systemctl restart kds-backend
```

Redeploy latest code:

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
