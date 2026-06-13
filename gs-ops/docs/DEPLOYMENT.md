# GS-OPS Deployment

## Development

Backend:

```powershell
cd backend
..\..\gts\gs.exe --timeout 0 run
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Production

Build the frontend and serve `frontend/dist` behind the backend or a static file server.
