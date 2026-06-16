# NazAQ CRM — Complete Setup Guide
# מדריך התקנה מלא

Total time: ~2 hours | Cost: $0 to start

---

## OVERVIEW — What you're setting up

```
nazaq-crm.html      → Your web app (GitHub Pages — free)
nazaq-backend/      → API server (Railway — free tier)
nazaq-android/      → Android call monitor app (APK)
Supabase            → Database (free — EU Frankfurt region)
```

---

## STEP 1 — Supabase Database (20 min)

### 1.1 Create account
1. Go to https://supabase.com
2. Click "Start your project" → Sign up with GitHub or email
3. Click "New Project"
4. Fill in:
   - **Name:** nazaq-crm
   - **Database Password:** Choose a strong password — SAVE IT
   - **Region:** ⚠️ Select **EU West (Frankfurt)** — keeps data in Europe
5. Wait 2 minutes for project to initialize

### 1.2 Run the database schema
1. In your Supabase project → click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file `nazaq-backend/schema.sql` from this project
4. Copy ALL the content and paste it into the SQL editor
5. Click **Run** (green button)
6. You should see: "Success. No rows returned"

### 1.3 Get your API keys
1. Go to **Settings** (gear icon, left sidebar) → **API**
2. Copy these two values — you'll need them in Step 2:
   - **Project URL** → looks like: `https://abcdefgh.supabase.co`
   - **service_role** key → long string starting with `eyJ...`
   ⚠️ Use the SERVICE_ROLE key (not the anon key). Keep it secret.

---

## STEP 2 — Deploy the Backend to Railway (15 min)

### 2.1 Push backend to GitHub
1. Go to https://github.com → create a new PRIVATE repository named `nazaq-backend`
2. On your computer, open Terminal (or Git Bash on Windows):
```bash
cd nazaq-backend
git init
git add .
git commit -m "Initial NazAQ backend"
git remote add origin https://github.com/YOUR_USERNAME/nazaq-backend.git
git push -u origin main
```

### 2.2 Deploy on Railway
1. Go to https://railway.app → Sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `nazaq-backend` repository
4. Railway will detect it's a Node.js app automatically
5. Click **Deploy**

### 2.3 Set environment variables in Railway
1. Click your deployed service → **Variables** tab
2. Add each variable (click + Add Variable for each):

```
SUPABASE_URL          = https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY  = eyJ... (your service_role key)
JWT_SECRET            = (run this to generate: openssl rand -hex 64)
ENCRYPTION_KEY        = (exactly 32 random characters, e.g: NazAQ2024SecureKey_xyz_12345678)
NODE_ENV              = production
PORT                  = 3001
ALLOWED_ORIGINS       = https://YOUR_GITHUB_USERNAME.github.io,*
ADMIN_USERNAME        = admin
ADMIN_PASSWORD        = YourSecurePassword123!
```

3. Railway will automatically redeploy after you add variables
4. Click **Settings** → find your public URL (e.g. `https://nazaq-backend-production.up.railway.app`)
5. **Save this URL** — you'll use it in the CRM and Android app

### 2.4 Test the backend
Open your browser and go to:
```
https://YOUR_RAILWAY_URL/health
```
You should see: `{"status":"ok","timestamp":"...","version":"1.0.0"}`

---

## STEP 3 — Update NazAQ CRM (5 min)

Open `nazaq-crm.html` in a text editor and find this line near the top of the `<script>` section:

```javascript
const API_BASE = 'YOUR_RAILWAY_URL_HERE';
```

Replace `YOUR_RAILWAY_URL_HERE` with your actual Railway URL:
```javascript
const API_BASE = 'https://nazaq-backend-production.up.railway.app';
```

---

## STEP 4 — Deploy CRM to GitHub Pages (10 min)

1. Go to GitHub → New repository named `nazaq-crm` (PUBLIC — needed for GitHub Pages)
2. Upload both `nazaq-crm.html` and `nazaq-admin.html`
3. Go to repository **Settings** → **Pages**
4. Source: **Deploy from a branch** → **main** → **/ (root)**
5. Click Save
6. Your CRM will be live at: `https://YOUR_USERNAME.github.io/nazaq-crm/nazaq-crm.html`

### Add your GitHub Pages URL to Railway
Go back to Railway → Variables → update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS = https://YOUR_USERNAME.github.io
```

---

## STEP 5 — First Login

1. Open `https://YOUR_USERNAME.github.io/nazaq-crm/nazaq-crm.html`
2. Log in with:
   - Username: `admin`
   - Password: `Admin@NazAQ2024`
3. **IMMEDIATELY** go to the admin panel and change the password

---

## STEP 6 — Android App (30 min)

### Option A: Use as a Progressive Web App (PWA) — Easiest
No installation needed:
1. Open `https://YOUR_USERNAME.github.io/nazaq-crm/nazaq-android/index.html` on the Android phone
2. In Chrome, tap **⋮ menu** → **Add to Home Screen**
3. It installs like an app. Calls must be logged manually (no auto-detection in PWA mode).

### Option B: Build a real APK (Auto call detection)

You need a computer with Node.js installed.

#### Install tools:
```bash
npm install -g @capacitor/cli
npm install -g @ionic/cli
```

#### Create the Capacitor project:
```bash
mkdir nazaq-app && cd nazaq-app
npm init -y
npm install @capacitor/core @capacitor/android
npm install @capacitor/app @capacitor/local-notifications
npx cap init NazAQ com.nazaq.crm --web-dir www
mkdir www
cp ../nazaq-android/index.html www/index.html
npx cap add android
```

#### Install the phone call plugin:
```bash
npm install capacitor-call-log
```

#### Add permissions to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE"/>
<uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>
<uses-permission android:name="android.permission.READ_CALL_LOG"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
```

#### Build the APK:
```bash
npx cap sync android
npx cap open android
```
This opens Android Studio. Click **Build** → **Generate Signed APK** → follow the wizard.

#### Install on phone:
1. Transfer the APK file to the Android phone
2. On the phone: **Settings** → **Security** → Enable **Unknown Sources**
3. Open the APK file to install
4. Grant all requested permissions (phone state, call log)

---

## SECURITY CHECKLIST

After setup, verify each item:

- [ ] Changed default admin password
- [ ] Supabase region is EU Frankfurt (not US)
- [ ] `.env` file is NOT in GitHub (check `.gitignore`)
- [ ] Railway repo is set to PRIVATE
- [ ] HTTPS is working on all URLs (no http://)
- [ ] Test that `https://YOUR_SUPABASE_URL/rest/v1/students` returns `{}` (blocked by RLS)
- [ ] JWT_SECRET is at least 64 random characters
- [ ] ENCRYPTION_KEY is exactly 32 characters

---

## REGULAR MAINTENANCE

### Backups
Supabase automatically backs up your database daily (free tier: 1 day, Pro: 7 days).
To export manually: Supabase → **Database** → **Backups** → Download

### Monitoring
Railway shows your server logs in real time.
Check: Railway → your service → **Logs** tab

### Updating the app
```bash
git add .
git commit -m "Update description"
git push
```
Railway auto-deploys. GitHub Pages auto-deploys.

---

## COSTS SUMMARY

| Service | Free Tier | When you'd pay |
|---------|-----------|----------------|
| Supabase | 500MB DB, unlimited API | >500MB data (~50,000 students) |
| Railway | 500 hours/month | Always-on needs $5/mo Hobby plan |
| GitHub Pages | Unlimited | Never for static files |
| Domain (optional) | — | ~$10/year for custom domain |

**Recommendation:** Start free. Upgrade Railway to $5/month Hobby plan
to get always-on hosting (free tier sleeps after inactivity).

---

## SUPPORT

If anything goes wrong, the most common issues are:

1. **CORS error** — Add your website URL to `ALLOWED_ORIGINS` in Railway
2. **401 Unauthorized** — Token expired, log in again
3. **Cannot connect** — Check Railway URL is correct, service is running
4. **Data not saving** — Check Supabase service key (must be service_role, not anon)
