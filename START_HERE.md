# TerraAI — guía rápida (Windows)

**Esta versión solo tiene dos secciones:** Overview — My Farm y Environment.

1. Abre `terra-ai` en VS Code.
2. Terminal backend: `cd backend`, luego `py -m venv .venv` (si aún no existe), instala con `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`, y ejecuta `.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000`.
3. En `backend/.env` conserva tus propias variables `CDSE_CLIENT_ID` y `CDSE_CLIENT_SECRET` de Copernicus. **Nunca las incluyas al compartir el ZIP.**
4. Terminal frontend desde la **raíz** del proyecto: `cd frontend`, `npm.cmd install`, `npm.cmd run dev`.
5. Abre `http://localhost:5173/`. Dibuja el campo, selecciona fechas, pulsa **Analizar región** y abre **Environment**.
6. Si NDVI falla pero NASA funciona, verifica credenciales en `http://127.0.0.1:8000/api/status`. Copernicus falla por configuración de OAuth, red o cuota de uso, no necesariamente por error del mapa.

Para más detalles, consulta `README.md`.
