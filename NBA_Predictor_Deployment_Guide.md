# NBA Predictor - Complete Deployment Guide

## Overview

This guide covers the complete deployment process for the NBA Predictor application. The deployment uses:
- **Vercel** - Frontend hosting (FREE)
- **Railway** - Backend + PostgreSQL database ($5-10/month)
- **GitHub** - Code repository (FREE)

**Total Monthly Cost**: $5-10/month (plus optional $10/year for custom domain)

---

## Part 1: Your Tasks (15 minutes)

### Task 1: Create GitHub Account & Repository

**Step 1.1: Sign Up for GitHub**
1. Go to https://github.com
2. Click "Sign up"
3. Enter your email, create password
4. Verify your account

**Step 1.2: Create Repository**
1. Click the "+" icon → "New repository"
2. Repository name: `nba-predictor` (or your choice)
3. Description: "NBA Player Props Prediction Platform"
4. Select: **Public** (required for free Vercel hosting)
5. Do NOT check "Add README" or ".gitignore"
6. Click "Create repository"

**Step 1.3: Share Repository URL**
- Copy the repository URL (e.g., `https://github.com/YOUR_USERNAME/nba-predictor`)
- Share this with me

---

### Task 2: Create Railway Account

**Step 2.1: Sign Up**
1. Go to https://railway.app
2. Click "Login"
3. Click "Login with GitHub"
4. Authorize Railway to access your GitHub account
5. Complete any verification steps

**Step 2.2: Share Dashboard**
- Once logged in, you'll see the Railway dashboard
- Copy the URL from your browser (e.g., `https://railway.app/dashboard`)
- Share this with me

**What Railway Provides**:
- PostgreSQL database (managed, auto-backups)
- Backend Node.js hosting
- Automatic deployments from GitHub
- Built-in SSL certificates
- Cron job support for daily data refresh

**Cost**: Pay-as-you-go (~$5-10/month for this app)
- They give $5 free credit/month on trial
- Database: ~$3-5/month
- Backend: ~$2-5/month

---

### Task 3: Create Vercel Account

**Step 3.1: Sign Up**
1. Go to https://vercel.com
2. Click "Sign Up"
3. Click "Continue with GitHub"
4. Authorize Vercel to access your GitHub account
5. Complete any verification steps

**Step 3.2: Share Dashboard**
- Once logged in, you'll see the Vercel dashboard
- Copy the URL from your browser (e.g., `https://vercel.com/dashboard`)
- Share this with me

**What Vercel Provides**:
- Next.js frontend hosting (FREE tier)
- Global CDN (fast worldwide)
- Automatic deployments from GitHub
- Built-in SSL certificates
- 100GB bandwidth/month (plenty for starting)

**Cost**: $0/month (FREE tier sufficient)

---

### Task 4: Grant Me Access

**Step 4.1: GitHub Repository Access**
1. Go to your repository on GitHub
2. Click "Settings" (repository settings, not account settings)
3. Click "Collaborators" in left sidebar
4. Click "Add people"
5. Enter my GitHub username: `[I'll provide when ready]`
6. Select role: **Admin**
7. Click "Send invitation"

**Step 4.2: Railway Project Access**
(We'll do this after I create the Railway project)
1. Go to your Railway project
2. Click "Settings"
3. Click "Members"
4. Click "Invite Member"
5. Enter my email: `[I'll provide when ready]`
6. Select role: **Admin**

**Step 4.3: Vercel Project Access**
(We'll do this after I create the Vercel project)
1. Go to your Vercel project
2. Click "Settings"
3. Click "Members"
4. Enter my email: `[I'll provide when ready]`
5. Select role: **Admin**

---

## Part 2: What I'll Deploy (You Just Monitor)

### Session 1: Backend Deployment on Railway (~30 minutes)

**My Actions**:

1. **Push Code to GitHub**
   - Connect your local repository to GitHub
   - Push all backend code
   - Push all frontend code
   - Set up .gitignore for sensitive files

2. **Create PostgreSQL Database**
   - Create new Railway project
   - Add PostgreSQL service
   - Note database credentials (automatic)
   - Railway provides: DATABASE_URL, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD

3. **Run Database Migration**
   - Connect to Railway PostgreSQL
   - Execute schema.sql
   - Create all tables: teams, players, matches, player_game_stats, predictions, etc.
   - Verify schema created successfully

4. **Deploy Backend Application**
   - Add new service in Railway project
   - Connect to your GitHub repository
   - Set root directory: `/backend`
   - Configure build command: `npm install && npm run build`
   - Configure start command: `npm start`

5. **Configure Environment Variables**
   Railway backend environment variables:
   ```
   NODE_ENV = production
   PORT = 3001
   DB_HOST = [from Railway PostgreSQL]
   DB_PORT = 5432
   DB_NAME = [from Railway PostgreSQL]
   DB_USER = [from Railway PostgreSQL]
   DB_PASSWORD = [from Railway PostgreSQL]
   ```

6. **Execute Initial Data Backfill**
   - Connect to Railway backend via CLI
   - Run: `npm run backfill`
   - Loads 500 completed games (~4 months of data)
   - Loads ~7,000+ player statistics
   - Ensures 350+ players have 15+ games for predictions
   - Estimated time: 90 minutes

7. **Verify Backend API**
   Test endpoints:
   - `GET /health` - Backend health check
   - `GET /api/matches?date=2026-01-28` - Match listings
   - `GET /api/predictions/168` - Match predictions
   - `GET /api/players/363/stats` - Player statistics

8. **Confirm Cron Job**
   - Verify cron scheduled for 6:30 AM UTC (12:00 Noon IST)
   - Check startup refresh logic working
   - Monitor logs for successful execution

**Your Backend URL**: `https://nba-predictor-backend.railway.app` (example)

---

### Session 2: Frontend Deployment on Vercel (~20 minutes)

**My Actions**:

1. **Import GitHub Repository**
   - Go to Vercel dashboard
   - Click "Add New" → "Project"
   - Select your GitHub repository
   - Vercel auto-detects Next.js

2. **Configure Build Settings**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `frontend`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

3. **Set Environment Variables**
   Vercel environment variables:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend.railway.app
   ```
   (Using the Railway backend URL from Session 1)

4. **Deploy Frontend**
   - Click "Deploy"
   - Vercel builds and deploys automatically
   - First deployment takes ~2-3 minutes
   - Vercel assigns URL: `https://nba-predictor.vercel.app` (example)

5. **Test Full Application**
   - Open Vercel URL in browser
   - Test date selection (should default correctly based on IST time)
   - View match listings
   - Click on match → View predictions
   - Click on player name → Opens player stats in new tab
   - Verify all data loading correctly

6. **Verify Automatic Deployments**
   - Make small change to frontend code
   - Push to GitHub
   - Vercel auto-deploys in ~1 minute
   - Confirm working

**Your Frontend URL**: `https://nba-predictor.vercel.app` (example)

---

### Session 3: Testing & Verification (~10 minutes)

**My Checklist**:

1. **Match Listings**
   - ✅ Today's date shows correct matches (IST timezone)
   - ✅ Tomorrow's date shows correct matches
   - ✅ Past dates cannot be selected
   - ✅ Match times display in IST correctly

2. **Predictions**
   - ✅ Click match → Predictions load
   - ✅ Players with predictions shown at top
   - ✅ Players without predictions at bottom
   - ✅ "Coming soon" message for games > 24 hours away
   - ✅ Predictions visible for games < 24 hours away

3. **Player Stats**
   - ✅ Click player name → Opens in new tab
   - ✅ Player info loads (name, team, position)
   - ✅ Season averages display correctly
   - ✅ Game log shows last 15 games
   - ✅ Back button not needed (new tab)

4. **Data Refresh**
   - ✅ Cron job scheduled for 12:00 Noon IST daily
   - ✅ Startup refresh checks if today's refresh completed
   - ✅ Logs visible in Railway dashboard
   - ✅ Database updating correctly

5. **Performance**
   - ✅ Page load times < 2 seconds
   - ✅ API response times < 500ms
   - ✅ No console errors
   - ✅ Mobile responsive

**Monitoring Dashboards**:
- Railway: View logs, CPU, memory usage
- Vercel: View deployments, analytics, logs

---

## Part 3: Domain Setup (Optional - For Later)

### When You're Ready for Custom Domain

**Step 1: Buy Domain**

You can use **ANY** domain registrar:
- ✅ **GoDaddy** - Most popular, good UI
- ✅ **Namecheap** - Cheaper, developer-friendly
- ✅ **Porkbun** - Cheapest, great features
- ✅ **Google Domains** - Simple, integrated with Google
- ✅ **Cloudflare** - Best DNS, $9/year

**Cost**: ~$9-15/year for .com domain

**Recommendation**: Any registrar works. GoDaddy is fine if you're familiar with it.

**Step 2: Share Domain Info**
- Domain name (e.g., `nbapredictor.com`)
- Registrar name
- Access to DNS settings (I'll guide you through changes)

**Step 3: I Configure DNS**

For Vercel (Frontend):
1. Go to your domain registrar
2. Add DNS record:
   - Type: `CNAME`
   - Name: `www` (or `@` for root domain)
   - Value: `cname.vercel-dns.com`
   - TTL: Automatic or 3600

3. In Vercel dashboard:
   - Go to Project Settings → Domains
   - Add your domain: `nbapredictor.com`
   - Verify DNS
   - SSL automatically enabled (free)

Backend stays on Railway subdomain (users don't see it directly).

**Step 4: Test Custom Domain**
- Visit: `https://nbapredictor.com`
- Should load your application
- SSL certificate active (🔒 in browser)
- All features working

---

## Part 4: Cost Breakdown

### Monthly Costs

| Service | Cost | What's Included |
|---------|------|-----------------|
| **Vercel (Frontend)** | **$0/month** | • Next.js hosting<br>• 100GB bandwidth/month<br>• Automatic deployments<br>• Global CDN<br>• Free SSL certificate |
| **Railway (Backend + DB)** | **$5-10/month** | • Node.js backend hosting<br>• PostgreSQL database<br>• Automatic deployments<br>• Cron job support<br>• Auto-backups<br>• Free SSL certificate |
| **Total** | **$5-10/month** | Fully hosted application |

### Annual Costs

| Item | Cost | When Needed |
|------|------|-------------|
| **Domain Name** | **$9-15/year** | Optional (can use Vercel subdomain initially) |
| **Total Annual** | **$60-135/year** | $5-10/month + $9-15 domain |

### Usage Limits (How to Stay Under $10/month)

**Vercel Free Tier**:
- ✅ 100GB bandwidth/month (plenty for starting)
- ✅ Unlimited deployments
- ✅ 100 GB-hours compute time
- ⚠️ If exceeded: Upgrade to $20/month Pro (unlikely initially)

**Railway Free Credits**:
- ✅ $5 free credit/month (trial)
- ✅ Pay-as-you-go after free credit
- ✅ Database: ~$3-5/month
- ✅ Backend: ~$2-5/month
- ⚠️ Total: Usually stays under $10/month for low-medium traffic

### What Happens If Traffic Grows?

**At 1,000 users/month**:
- Vercel: Still FREE
- Railway: ~$8-12/month

**At 10,000 users/month**:
- Vercel: Still FREE (unless bandwidth exceeds 100GB)
- Railway: ~$15-25/month

**At 100,000 users/month**:
- Vercel: ~$20/month (Pro plan)
- Railway: ~$50-80/month
- Consider optimization or migration to dedicated VPS

---

## Part 5: After Deployment

### What You'll Have

✅ **Live Website**
- Accessible worldwide at `https://your-app.vercel.app`
- Or custom domain: `https://nbapredictor.com`

✅ **Automatic Daily Updates**
- Data refreshes every day at 12:00 Noon IST
- Yesterday's completed games fetched
- Today's scheduled games fetched
- Predictions generated for games within 24 hours

✅ **Automatic Deployments**
- Push code to GitHub → Auto-deploys to production
- Frontend: ~1 minute deployment
- Backend: ~2-3 minute deployment
- Zero downtime deployments

✅ **Monitoring & Logs**
- Railway dashboard: Backend logs, database stats
- Vercel dashboard: Frontend analytics, deployment logs
- Email notifications for failed deployments

✅ **Security**
- Free SSL certificates (HTTPS)
- Automatic SSL renewal
- Secure environment variables
- Database backups

### Ongoing Maintenance

**What Runs Automatically**:
- ✅ Daily data refresh at 12:00 Noon IST
- ✅ Database backups (Railway)
- ✅ SSL certificate renewal
- ✅ Security updates (Railway & Vercel)

**What You Should Monitor**:
- 📊 Check Railway dashboard weekly for costs
- 📊 Check application working daily
- 📊 Monitor error logs (Railway will email you)
- 📊 Check database storage usage monthly

**When to Contact Me**:
- ❌ Application down/not working
- ❌ Predictions not generating
- ❌ Data not refreshing
- ❌ Costs exceeding $15/month
- ➕ Want to add new features

### Making Changes

**Code Changes**:
1. Make changes locally
2. Test locally: `npm run dev`
3. Commit to GitHub: `git push`
4. Auto-deploys to production

**Database Changes**:
1. Test locally first
2. Create migration script
3. I can run on production (safer)

**Environment Variables**:
1. Update in Railway dashboard
2. Update in Vercel dashboard
3. Redeploy if needed

---

## Part 6: Support & Monitoring

### Free Monitoring Tools

**1. UptimeRobot** (https://uptimerobot.com)
- FREE tier: 50 monitors
- Check if website is up every 5 minutes
- Email alerts if down
- Setup: Add your Vercel URL + Railway health check URL

**2. Railway Dashboard**
- View real-time logs
- Monitor CPU/memory usage
- Database connection stats
- Deployment history

**3. Vercel Analytics**
- Page views
- Response times
- User locations
- Error tracking

### Email Notifications

Railway will email you:
- ✅ Deployment succeeded/failed
- ❌ Database connection issues
- ⚠️ Approaching usage limits
- 💳 Monthly invoice

Vercel will email you:
- ✅ Deployment succeeded/failed
- ⚠️ Approaching bandwidth limits

### Manual Health Checks

**Daily Check** (30 seconds):
1. Visit your website
2. Select today's date
3. Click on a match
4. Verify predictions loading

**Weekly Check** (5 minutes):
1. Check Railway dashboard → Logs
2. Confirm "Today's refresh completed at ..."
3. Check database size (should be < 500MB)
4. Check monthly cost (should be < $10)

---

## Part 7: Backup & Recovery

### Automated Backups

**Railway PostgreSQL**:
- ✅ Automatic daily backups
- ✅ Retained for 7 days (free tier)
- ✅ One-click restore from Railway dashboard

**GitHub Repository**:
- ✅ All code backed up automatically
- ✅ Full version history
- ✅ Can revert to any previous version

### Manual Backup (Recommended: Weekly)

**Backup Database**:
```bash
# Using Railway CLI
railway login
railway link [your-project]
railway run pg_dump > backup-$(date +%Y%m%d).sql
```

Store backups on:
- Google Drive
- Dropbox
- External hard drive

### Disaster Recovery

**If Backend Goes Down**:
1. Check Railway status page
2. Check deployment logs
3. Redeploy from Railway dashboard
4. Contact me if issue persists

**If Frontend Goes Down**:
1. Check Vercel status page
2. Check deployment logs
3. Redeploy from Vercel dashboard
4. Contact me if issue persists

**If Database Corrupted**:
1. Check Railway backups
2. Restore from most recent backup
3. Re-run backfill if needed (90 minutes)

**If Everything Lost** (Worst Case):
1. Repository on GitHub (code safe)
2. Create new Railway project
3. Create new PostgreSQL database
4. Run schema migration
5. Run backfill (500 games)
6. Redeploy frontend
7. Total recovery time: ~2-3 hours

---

## Part 8: FAQ

### Q: Can I use GoDaddy for domain instead of Namecheap?
**A:** Yes! You can use ANY domain registrar:
- GoDaddy ✅
- Namecheap ✅
- Porkbun ✅
- Google Domains ✅
- Cloudflare ✅
- Any other registrar ✅

All domain registrars work the same way. Just need to add a CNAME record pointing to Vercel.

### Q: What if I exceed Vercel's 100GB bandwidth?
**A:**
- For starting, 100GB is plenty (supports ~50,000 visits/month)
- If exceeded, Vercel automatically upgrades you to Pro ($20/month)
- You'll get email warning before this happens
- Can add Cloudflare CDN (free) to reduce bandwidth usage

### Q: Can I pause Railway to save money?
**A:**
- Railway charges only when running
- Can pause project when not using (stops charges)
- Unpause when needed (takes ~1 minute to restart)
- Database persists (no data loss)

### Q: How do I scale if traffic grows?
**A:**
1. **0-10,000 users/month**: Current setup ($5-10/month) ✅
2. **10,000-50,000 users/month**: Optimize queries, add caching (~$15-25/month)
3. **50,000+ users/month**: Consider dedicated VPS or migrate to AWS (~$50-100/month)

### Q: Can I change hosting providers later?
**A:** Yes! Everything can be migrated:
- Code: Already on GitHub
- Database: Export and import to new provider
- Frontend: Redeploy to any Next.js host
- Backend: Redeploy to any Node.js host

### Q: What if daily refresh fails?
**A:**
- Railway emails you automatically
- Check logs in Railway dashboard
- Script retries failed operations
- Worst case: I can manually trigger refresh
- Data won't break (just won't update for that day)

### Q: Do I need to buy domain immediately?
**A:** No!
- Start with free Vercel subdomain: `nba-predictor.vercel.app`
- Buy domain later when ready
- Easy to add domain (takes 5 minutes)
- No downtime when switching

### Q: Can I see database data?
**A:** Yes!
- Railway provides web-based database viewer
- Can connect with any PostgreSQL client (pgAdmin, DBeaver, etc.)
- Use Railway connection string
- Read-only recommended for safety

### Q: What if I want to add features later?
**A:**
- Share feature request with me
- I'll implement in local environment
- Test thoroughly
- Push to GitHub → Auto-deploys
- Zero downtime for users

---

## Part 9: Let's Get Started!

### Pre-Deployment Checklist

**Before We Start**:
- [ ] Email address ready (for Railway, Vercel signup)
- [ ] GitHub account created (or ready to create)
- [ ] 1 hour free for deployment session
- [ ] Payment method ready for Railway (credit/debit card)

**Create These Accounts** (15 minutes):
- [ ] GitHub account + repository created
- [ ] Railway account created (signed in with GitHub)
- [ ] Vercel account created (signed in with GitHub)

**Grant Me Access**:
- [ ] Added me as collaborator on GitHub repository
- [ ] Shared Railway dashboard link
- [ ] Shared Vercel dashboard link
- [ ] Confirmed you're ready for me to start deployment

### Deployment Schedule

**Session 1: Backend Setup** (30 minutes)
- Railway database creation
- Backend deployment
- Database migration
- Environment variables configuration

**Break** (While backfill runs - 90 minutes)
- Initial data load (500 games)
- You can step away during this
- I'll notify you when complete

**Session 2: Frontend Setup** (20 minutes)
- Vercel project setup
- Frontend deployment
- Environment variables
- Testing

**Session 3: Verification** (10 minutes)
- End-to-end testing
- Monitoring setup
- Handoff and training

**Total Active Time**: ~60 minutes
**Total Calendar Time**: ~2.5 hours (including backfill)

### Contact Information

When ready to deploy, share with me:
1. ✅ GitHub repository URL
2. ✅ Railway dashboard link
3. ✅ Vercel dashboard link
4. ✅ Your availability (date/time for deployment session)
5. ✅ Preferred communication method (chat/video call)

### What to Expect

**During Deployment**:
- I'll ask for account access
- I'll share screen or provide updates
- You can watch everything happening live
- Ask questions anytime
- Takes ~1 hour active work + 90 minutes waiting for backfill

**After Deployment**:
- You'll have live website URL
- I'll show you Railway and Vercel dashboards
- I'll explain monitoring and maintenance
- You can start sharing with users!

**Ongoing Support**:
- Available for questions via email/chat
- Can troubleshoot issues remotely
- Can add features or make changes
- Can help optimize costs

---

## Ready to Deploy?

Just say: **"Let's deploy!"**

And provide:
- When you're available (date/time)
- GitHub repository URL (after creation)
- Railway dashboard link (after signup)
- Vercel dashboard link (after signup)

I'll handle all the technical deployment, you just watch and learn! 🚀

---

## Appendix: Technical Details

### Environment Variables Reference

**Backend (Railway)**:
```bash
NODE_ENV=production
PORT=3001
DB_HOST=<from Railway PostgreSQL>
DB_PORT=5432
DB_NAME=<from Railway PostgreSQL>
DB_USER=<from Railway PostgreSQL>
DB_PASSWORD=<from Railway PostgreSQL>
```

**Frontend (Vercel)**:
```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### NPM Scripts Reference

```bash
# Backend
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run backfill     # Run initial data load (500 games)

# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
```

### Database Schema

**Tables Created**:
- `teams` - NBA team information
- `players` - Player roster
- `matches` - Game schedule and results
- `player_game_stats` - Historical player performance
- `player_status` - Injury/availability information
- `predictions` - Generated predictions for upcoming games
- `prediction_accuracy` - Track prediction performance (admin)
- `data_refresh_log` - Track daily data refreshes

**Total Database Size**: ~100-200MB initially, grows ~10-20MB/month

### API Endpoints

```
GET /health
GET /api/matches?date=YYYY-MM-DD
GET /api/predictions/:matchId
GET /api/players/:playerId/stats
GET /api/players/search?query=name
```

### Cron Schedule

```
30 6 * * *  (Runs at 6:30 AM UTC = 12:00 Noon IST)
```

Daily refresh process:
1. Fetch yesterday's completed games
2. Fetch player stats for completed games
3. Fetch today's scheduled games
4. Generate predictions for games within 24 hours
5. Log refresh to database

---

**Document Version**: 1.0
**Last Updated**: January 27, 2026
**Created For**: NBA Predictor Application Deployment
