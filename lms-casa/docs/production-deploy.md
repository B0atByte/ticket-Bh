# Production Deploy Guide

This guide documents the current production path for LMS Casa. Keep secrets outside git and use the production MySQL user with limited privileges.

## 1. Build And Runtime Model

- Frontend: build static assets from `client/dist` and serve them through nginx.
- Backend web: run `server/dist/server.js` with `ENABLE_WORKERS=false`.
- Backend worker: run the same server image with `ENABLE_WORKERS=true`; expose no public port.
- Database: MySQL 8 with `utf8mb4_unicode_ci`.
- Queue/cache: Redis 7 with a password and append-only persistence.
- File uploads: mount persistent storage for `server/uploads`.

## 2. Required Environment

Server:

```bash
NODE_ENV=production
PORT=4000
APP_URL=https://lms.example.com
CORS_ORIGIN=https://lms.example.com
DATABASE_URL=mysql://lms_user:<password>@mysql:3306/lms
REDIS_URL=redis://:<password>@redis:6379
JWT_ACCESS_SECRET=<openssl-rand-base64-64>
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
MUTATION_RATE_LIMIT_MAX=120
LOG_LEVEL=info
SENTRY_DSN=<optional-server-dsn>
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
MAIL_FROM=LMS Casa <noreply@example.com>
ENABLE_WORKERS=false
```

Worker:

```bash
ENABLE_WORKERS=true
PORT=4001
```

Client build:

```bash
VITE_API_URL=https://lms.example.com
VITE_API_PREFIX=/api/v1
VITE_DEFAULT_LOCALE=th
VITE_SENTRY_DSN=<optional-client-dsn>
```

SSO stays disabled until provider details are confirmed:

```bash
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=https://lms.example.com/api/v1/auth/oidc/callback
OIDC_AUTO_PROVISION=false
```

## 3. Database Migration

Use Prisma deploy mode in production. Do not run `prisma migrate dev` in production because it may need shadow database privileges.

```bash
cd server
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

For Docker images, run migration as a one-off release job before starting the new web and worker containers:

```bash
docker compose run --rm server npx prisma migrate deploy
docker compose --profile app up -d server
```

If you split workers into a separate container, run the same image without publishing a port and set `ENABLE_WORKERS=true` only on that worker container.

## 4. nginx Reverse Proxy

Example nginx site:

```nginx
server {
  listen 80;
  server_name lms.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name lms.example.com;

  ssl_certificate /etc/letsencrypt/live/lms.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/lms.example.com/privkey.pem;

  client_max_body_size 25m;

  root /var/www/lms-client;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Keep access logs configured so query strings are not stored if SSO or SSE tokens are ever passed in URLs.

## 5. Daily MySQL Backup

Create a backup directory owned by the deploy user:

```bash
mkdir -p /var/backups/lms/mysql
chmod 700 /var/backups/lms/mysql
```

Cron example:

```cron
15 2 * * * MYSQL_PWD='<password>' mysqldump --single-transaction --routines --triggers --default-character-set=utf8mb4 -h 127.0.0.1 -u lms_backup lms | gzip > /var/backups/lms/mysql/lms-$(date +\%F).sql.gz
30 2 * * * find /var/backups/lms/mysql -type f -name 'lms-*.sql.gz' -mtime +14 -delete
```

Use a dedicated MySQL backup user:

```sql
CREATE USER 'lms_backup'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON lms.* TO 'lms_backup'@'%';
FLUSH PRIVILEGES;
```

Test restore regularly in a non-production database.

## 6. Release Checklist

Run before each production release:

```bash
cd server && npm run typecheck && npm run lint && npm test && npm audit --audit-level=moderate
cd client && npm run typecheck && npm run lint && npm test && npm run build && npm audit --audit-level=moderate
cd client && npm run e2e
```

Also run k6 when it is installed on the host:

```bash
k6 run k6/smoke-test.js
k6 run k6/load-test.js
```

Current known limits:

- Server unit coverage is below the 70% target and needs more backend service/controller tests.
- OIDC route wiring still needs real provider details.
- k6 scripts exist, but k6 is not installed on the current machine.
