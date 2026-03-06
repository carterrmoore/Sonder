# Sonder — Landing Page

Static landing page. One file. No build step required.

---

## Deploying to Vercel

### 1. Push this repo to GitHub

```bash
git init
git add .
git commit -m "Initial landing page"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sonder-site.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Import your `sonder-site` repository
4. Leave all settings as default — Vercel detects static HTML automatically
5. Click **Deploy**

Your site will be live at a `*.vercel.app` URL within about 30 seconds.

---

## Adding your custom domain

### Option A — Hand off nameservers (recommended, fewer steps)

1. In Vercel: go to your project → **Settings** → **Domains** → add your domain
2. Vercel will show you two nameserver addresses, e.g:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
3. In Squarespace: **Domains** → your domain → **DNS Settings** → **Nameservers** → switch to **Custom** and paste Vercel's nameservers
4. Wait up to a few hours for propagation (usually faster)

### Option B — Keep DNS in Squarespace, just point records

1. In Vercel: go to your project → **Settings** → **Domains** → add your domain
2. In Squarespace DNS, add:
   - **A record**: Host `@` → Value `76.76.21.21`
   - **CNAME record**: Host `www` → Value `cname.vercel-dns.com`
3. Back in Vercel, verify the domain — it will show green once DNS propagates

---

## Updating the site

Once connected, any push to `main` triggers an automatic redeploy. Takes about 15 seconds.

```bash
# Make changes to index.html, then:
git add .
git commit -m "Update copy"
git push
```
