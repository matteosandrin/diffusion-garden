# AI Blocks Canvas

A block-based AI creativity canvas for rapid creative exploration. Compose ideas as networks of text and image blocks, connect them into directed acyclic graphs (DAGs), and use AI tools to branch, remix, and evolve those ideas.

## Features

- **Text Blocks**: Write and expand ideas using GPT-4o
- **Image Blocks**: Upload images or generate them from text prompts
- **AI Tools**:
  - **Expand**: Elaborate on text ideas
  - **Describe**: Generate detailed descriptions of images
  - **Generate**: Create images from text prompts using Gemini
- **DAG Connections**: Connect blocks to track idea lineage
- **Pan & Zoom**: Navigate an infinite canvas
- **Auto-save**: Your work is automatically saved

## Tech Stack

- **Frontend**: React + TypeScript + Vite + React Flow + Zustand + Tailwind CSS
- **Backend**: Python + FastAPI + SQLAlchemy + SQLite
- **AI**: OpenAI GPT-4o (text/vision) + Google Gemini (image generation)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- OpenAI API key
- Google API key (for Gemini)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API keys
cat > .env << EOF
OPENAI_API_KEY=your-openai-key-here
GOOGLE_API_KEY=your-google-key-here
DATABASE_URL=sqlite:///./canvas.db
EOF

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at http://localhost:5173

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New text block |
| `I` | New image block |
| `Delete` | Delete selected block |
| `Escape` | Deselect |

## Project Structure

```
ai-blocks-canvas/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.tsx
│   │   │   ├── nodes/
│   │   │   │   ├── TextBlockNode.tsx
│   │   │   │   └── ImageBlockNode.tsx
│   │   │   ├── edges/
│   │   │   │   └── AnimatedEdge.tsx
│   │   │   └── ui/
│   │   ├── store/
│   │   │   └── canvasStore.ts
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── types/
│   │       └── index.ts
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routers/
│   │   └── services/
│   └── requirements.txt
└── README.md
```

## API Endpoints

### Canvas
- `POST /api/canvas` - Create new canvas
- `GET /api/canvas/{id}` - Load canvas
- `PUT /api/canvas/{id}` - Save canvas
- `DELETE /api/canvas/{id}` - Delete canvas

### AI Tools
- `POST /api/tools/expand` - Expand text
- `POST /api/tools/describe` - Describe image
- `POST /api/tools/generate` - Generate image

### Images
- `POST /api/images/upload` - Upload image
- `GET /api/images/{id}` - Get image

## License

MIT

