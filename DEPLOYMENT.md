# 🚀 Deployment Guide

## Render Deployment

### Manual Configuration (Recommended)

1. **Go to Render Dashboard**: [render.com](https://render.com)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select repository: `Naresh2627/backend-server`

3. **Configure Service**:
   ```
   Name: habit-tracker-backend
   Environment: Node
   Region: Choose closest to your users
   Branch: main
   Root Directory: (leave empty)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Set Environment Variables**:
   ```
   NODE_ENV=production
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CLIENT_URL=https://your-frontend-domain.vercel.app
   ```

5. **Deploy**: Click "Create Web Service"

### Alternative: Railway Deployment

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy**:
   ```bash
   railway login
   railway up
   ```

3. **Set Environment Variables** in Railway dashboard

### Alternative: Heroku Deployment

1. **Install Heroku CLI**

2. **Deploy**:
   ```bash
   heroku create habit-tracker-backend
   heroku config:set NODE_ENV=production
   heroku config:set SUPABASE_URL=your-url
   heroku config:set SUPABASE_SERVICE_ROLE_KEY=your-key
   heroku config:set CLIENT_URL=your-frontend-url
   git push heroku main
   ```

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `SUPABASE_URL` | Supabase project URL | `https://abc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJ...` |
| `CLIENT_URL` | Frontend URL | `https://app.vercel.app` |

## Testing Deployment

After deployment, test these endpoints:

- `GET /` - API info
- `GET /api/health` - Health check
- `POST /api/auth/register` - Test registration

## Troubleshooting

- Ensure all environment variables are set
- Check logs for specific error messages
- Verify Supabase credentials are correct
- Test locally first with `npm start`