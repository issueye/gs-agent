# GS-OPS API

Base URL: `http://127.0.0.1:7310`

## Health

- `GET /api/health`

## Services

- `GET /api/services`
- `GET /api/services/:id`
- `POST /api/services/:id/install`
- `POST /api/services/:id/start`
- `POST /api/services/:id/stop`
- `POST /api/services/:id/restart`
- `GET /api/services/:id/actions/start`
- `GET /api/services/:id/actions/stop`
- `GET /api/services/:id/actions/restart`
- `GET /api/actions/start/:id`
- `GET /api/actions/stop/:id`
- `GET /api/actions/restart/:id`
- `DELETE /api/services/:id/uninstall`
- `GET /api/services/:id/status`
- `PUT /api/services/:id/config`
- `GET /api/services/:id/config/backups`
- `POST /api/services/:id/config/backups`
- `POST /api/services/:id/config/backups/:backupId/restore`
- `GET /api/services/:id/config/actions/backup`
- `GET /api/services/:id/config/backups/:backupId/actions/restore`
- `GET /api/actions/backup-config/:id`
- `GET /api/actions/restore-config/:id/:backupId`
- `GET /api/services/:id/metrics`
- `GET /api/services/:id/logs`
- `DELETE /api/services/:id/logs`
- `GET /api/services/:id/versions`
- `POST /api/services/:id/upgrade?version=0.1.1`
- `POST /api/services/:id/rollback?version=0.1.0`
- `GET /api/services/:id/actions/upgrade?version=0.1.1`
- `GET /api/services/:id/actions/rollback?version=0.1.0`
- `GET /api/actions/upgrade/:id?version=0.1.1`
- `GET /api/actions/rollback/:id?version=0.1.0`

Responses use this envelope:

```json
{
  "success": true,
  "message": "ok",
  "data": {}
}
```
