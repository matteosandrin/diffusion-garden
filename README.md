# https://diffusion.garden

A block-based AI canvas for rapid creative exploration. Compose ideas
as networks of text and image blocks, connect them into directed acyclic graphs
(DAGs), and use AI tools to branch, remix, and evolve those ideas.

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

## Deployment to Railway

This app is configured for Railway deployment with two separate services.

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app) and create a new empty project
2. Add a PostgreSQL database: **New** → **Database** → **PostgreSQL**

### 2. Deploy Backend

1. **New** → **GitHub Repo** → Select this repo
2. Set **Root Directory** to `backend`
3. Add environment variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `GOOGLE_API_KEY` - Your Google AI API key
   - `IMAGES_DIR` - `/app/images`
   - `FRONTEND_URL` - (add after frontend is deployed)
   - `DEBUG` - `false`
4. Link the PostgreSQL service (auto-injects `DATABASE_URL`)
5. Add a **Volume** mounted at `/app/images` for image storage
6. Generate a domain

### 3. Deploy Frontend

1. **New** → **GitHub Repo** → Select the same repo
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   - `VITE_API_HOST` - `https://your-backend-domain.railway.app/api`
4. Generate a domain

### 4. Finalize

1. Go back to the backend service
2. Add `FRONTEND_URL` environment variable with the frontend domain (e.g., `https://your-frontend-domain.railway.app`)

### Environment Variables Reference

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend | PostgreSQL connection string (auto from Railway) |
| `OPENAI_API_KEY` | Backend | OpenAI API key |
| `GOOGLE_API_KEY` | Backend | Google AI API key |
| `IMAGES_DIR` | Backend | Path to image storage directory |
| `FRONTEND_URL` | Backend | Frontend domain for CORS |
| `DEBUG` | Backend | Set to `false` for production |
| `VITE_API_HOST` | Frontend | Backend API URL |
