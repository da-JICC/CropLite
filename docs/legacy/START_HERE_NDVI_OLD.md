# TerraAI — Start here

This ZIP is an **updated copy of the earlier TerraAI React source ZIP**. It does NOT modify any existing GitHub repository. If you have edited your local project after downloading the original, merge these changes rather than overwriting newer files blindly.

## Where to look

Open the **React app** and click **Environmental Conditions → NDVI field explorer**.

- **Simulated example** works without an account or backend.
- **Live Copernicus API** requires the new Python backend, a free Copernicus account and an OAuth client.
- Click **Draw field**, outline a *real* field, then select dates and **Analyze NDVI**.
- **CSV** downloads numerical NDVI statistics.

## Running it in VS Code (Windows)

Open the `terra-ai` folder in VS Code. Use **two terminals**:

**Terminal 1 — Python**

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
# Fill in the Copernicus OAuth Client ID and Secret, save.
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
```

Check <http://localhost:8000/api/status>.

**Terminal 2 — React**

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL that Vite prints, usually <http://localhost:5173>.

**Important:** don't put your OAuth secret in `frontend/`, GitHub, screenshots or public chat messages. `backend/.env` is ignored by Git.

For a complete technical guide see [`docs/ndvi-integration.md`](docs/ndvi-integration.md).
