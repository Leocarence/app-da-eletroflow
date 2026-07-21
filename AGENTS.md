# Persistent Rules & Optimization Guidelines

## Network & Infrastructure Optimization Standard (Vercel & Cloud Edge Cost Savings)

For all features, data sync engines, and API endpoints created or maintained in this project, adhere to the following bandwidth and request optimization standards:

1. **HTTP Caching & Immutable Static Assets**
   - Serve Vite static assets (CSS, JS, media) with `Cache-Control: public, max-age=31536000, immutable` headers to minimize **Fast Origin Transfer** and redundant server bandwidth.

2. **Conditional Requests & ETag Validation**
   - API endpoints that return system state or polling data (e.g. `/api/load-data`) MUST generate and send `ETag` headers.
   - Handle client `If-None-Match` headers and return `304 Not Modified` with an empty body when payload version has not changed. This drastically cuts **Fast Origin Transfer** and bandwidth consumption.

3. **Smart & Eco-Friendly Client Polling**
   - Never run tight or unconditioned background `setInterval` timers (e.g. 5-second polling).
   - Use smart polling intervals (30s+ minimum).
   - Immediately pause background polling whenever the tab or document is hidden (`document.visibilityState !== 'visible'`).
   - Automatically trigger an immediate sync check when the user returns to the tab (`visibilitychange` / `window.focus`).
