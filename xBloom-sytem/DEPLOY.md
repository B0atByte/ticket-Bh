# Deploy — VPS + Docker + GitHub Actions

Auto-deploy flow: **push to `main` → GitHub Actions → SSH to VPS → `docker compose` rebuilds**.
The VPS builds the images itself; secrets live only on the VPS (never in git).

---

## 1. เตรียม VPS (ครั้งเดียว)

Ubuntu 22.04+ แนะนำ. ติดตั้ง Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login ใหม่
```

สร้าง deploy user + โฟลเดอร์:

```bash
sudo mkdir -p /opt/xbloom && sudo chown $USER /opt/xbloom
```

## 2. โคลน repo ลง VPS

repo เป็น **private** → ใส่ **Deploy Key** (อ่านอย่างเดียว):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/xbloom_deploy -N ""
cat ~/.ssh/xbloom_deploy.pub   # เอาไปใส่ใน GitHub repo → Settings → Deploy keys (Read)
git clone git@github.com:B0atByte/xBloom-sytem.git /opt/xbloom
```

## 3. สร้าง `.env` บน VPS (ห้ามมาจาก git!)

```bash
cd /opt/xbloom
cp .env.example .env
nano .env
```

ตั้งค่า **production** (อย่าใช้ค่า dev):

```env
NODE_ENV=production
MYSQL_ROOT_PASSWORD=<สุ่มยาว>
MYSQL_PASSWORD=<สุ่มยาว>
DATABASE_URL=mysql://xbloom:<MYSQL_PASSWORD>@mysql:3306/xbloom
JWT_SECRET=<openssl rand -hex 32>      # ต้องแข็งแรง ไม่งั้น API ไม่บูท
CORS_ORIGINS=https://your-domain.com   # ใส่โดเมนจริง (อย่าเว้นว่าง)
DEEPSEEK_API_KEY=<คีย์ใหม่หลัง rotate>  # คีย์เก่าหลุดในแชตแล้ว ต้องออกใหม่
WEB_PORT=8080                          # ให้ Caddy/พร็อกซีคุม 80/443 แทน
```

สร้าง secret แข็งแรง: `openssl rand -hex 32`

## 4. TLS / โดเมน (HTTPS)

ชี้ A record ของโดเมน → IP ของ VPS. วิธีง่ายสุด = **Caddy** (auto Let's Encrypt):

```bash
# /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:8080
}
```

(หรือใช้ Cloudflare proxy / nginx+certbot ก็ได้)

## 5. รันครั้งแรก + โหลดข้อมูล

```bash
cd /opt/xbloom
docker compose -f docker-compose.prod.yml up -d --build   # api รัน migration ให้เอง
# โหลดข้อมูลจริงจากสเปรดชีต (อยู่นอก git — อัปโหลดไฟล์ขึ้น VPS เอง):
cd backend && DATABASE_URL="mysql://xbloom:<pw>@localhost:3306/xbloom" JWT_SECRET=x npm run db:import -- "../xBloom Warranty.xlsx"
```

## 6. เปิด auto-deploy (GitHub Actions)

ใส่ Secrets ที่ repo → **Settings → Secrets and variables → Actions**:

| Secret | ค่า |
| --- | --- |
| `VPS_HOST` | IP/hostname ของ VPS |
| `VPS_USER` | ssh user (เช่น `ubuntu`) |
| `VPS_SSH_KEY` | private key ของ user นั้น (ที่ public key อยู่ใน `~/.ssh/authorized_keys` บน VPS) |
| `VPS_PATH` | `/opt/xbloom` |

จากนั้นทุกครั้งที่ `git push origin main` → `.github/workflows/deploy.yml` จะ SSH เข้า VPS แล้ว `git pull` + `docker compose up -d --build` ให้อัตโนมัติ

> หมายเหตุ: VPS ต้อง `git pull` ได้เอง — ใช้ Deploy Key (ข้อ 2) หรือทำ repo เป็น public

## 7. ✅ Checklist ก่อน production จริง
- [ ] `JWT_SECRET` แข็งแรง (`openssl rand -hex 32`) — ไม่งั้น API ไม่บูท
- [ ] เปลี่ยนรหัส MySQL จากค่า dev
- [ ] `CORS_ORIGINS` = โดเมนจริง (ไม่เว้นว่าง)
- [ ] **rotate `DEEPSEEK_API_KEY`** (คีย์เดิมหลุดแล้ว)
- [ ] TLS/HTTPS เปิด (ข้อ 4)
- [ ] เอาป้าย **DEMO** ออก (ui.tsx / StaffApp.tsx / Footer.tsx) เมื่อพร้อมจริง
- [ ] เปลี่ยน PIN พนักงานจากค่าเริ่มต้น
- [ ] ตั้ง cron `scripts/backup.sh`
