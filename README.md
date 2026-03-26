# https://diffusion.garden

A block-based AI canvas for rapid creative exploration. Compose ideas
as networks of text and image blocks, connect them into directed acyclic graphs
(DAGs), and use AI tools to branch, remix, and evolve those ideas.

Check out the demo below:

[![](https://github.com/matteosandrin/diffusion-garden/blob/master/img/thumbnail.png?raw=true)](https://youtu.be/iSUNGcwaHM0)

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
export DATABASE_URL="postgresql://username:password@localhost:5432/diffusiongarden"
export IMAGES_DIR="./images"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Deployment

### Frontend (GitHub Pages)

The frontend is automatically deployed to GitHub Pages via a GitHub Actions workflow on every push to `master` that modifies files in `frontend/`.

**Setup:**
1. In your repo settings, enable GitHub Pages with **Source** set to **GitHub Actions**
2. Add a repository secret `VITE_API_HOST` with the backend API URL (e.g., `https://your-backend-domain.railway.app/api`)
3. If using a custom domain, configure it in the Pages settings

The workflow (`.github/workflows/deploy-frontend.yml`) builds the Vite app and copies `index.html` to `404.html` for SPA routing.

### Backend (Railway)

1. Go to [railway.app](https://railway.app) and create a new empty project
2. Add a PostgreSQL database: **New** → **Database** → **PostgreSQL**
3. **New** → **GitHub Repo** → Select this repo
4. Set **Root Directory** to `backend`
5. Add environment variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `GOOGLE_API_KEY` - Your Google AI API key
   - `IMAGES_DIR` - `/app/images`
   - `FRONTEND_URL` - Your GitHub Pages URL (for CORS)
   - `DEBUG` - `false`
6. Link the PostgreSQL service (auto-injects `DATABASE_URL`)
7. Add a **Volume** mounted at `/app/images` for image storage
8. Generate a domain

### Environment Variables Reference

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string (auto from Railway) |
| `OPENAI_API_KEY` | Backend | OpenAI API key |
| `GOOGLE_API_KEY` | Backend | Google AI API key |
| `IMAGES_DIR` | Backend | Path to image storage directory |
| `FRONTEND_URL` | Backend | GitHub Pages URL for CORS |
| `DEBUG` | Backend | Set to `false` for production |
| `VITE_API_HOST` | Frontend | Backend API URL (set as GitHub repo secret) |
