# TerraAI · QA observations

## Verified in this environment

- All included JSON mock datasets parsed successfully.
- The standalone HTML preview's JavaScript parsed successfully.
- The standalone preview generated non-empty content for all nine page routes using an isolated JavaScript runtime.
- The React `.jsx` files passed an initial TypeScript JSX syntax parse.
- Navigation, farm switching, priority weighting, series filtering, preview rendering and local HTML report generation are represented in source.

## Not verified here

- `npm install` and `vite build`: package registry DNS resolution failed in this sandbox.
- Full browser rendering/screenshot: sandbox Chromium failed to complete a headless run.
- Production runtime interactions of React + Leaflet + Recharts: require a real browser and installed npm dependencies.

## Suggested manual smoke test

1. Launch React dev server, verify Overview renders without console errors.
2. Switch farm from Casablanca → Ñuble and verify changed statistics, soil type, crop history, rotations, map center and recommendations.
3. In Rotation Explorer select water priority and confirm strategy fit values change; choose another strategy and inspect its extended details.
4. Select a crop category, open a crop profile, and change planning horizon from 4 to 6 seasons.
5. In Environment switch metric, season and map layer; check chart updates.
6. In Strategy Comparison verify A, B and C all appear, with lower water demand clearly marked preferable.
7. Export HTML and use browser Print → Save as PDF.
8. On Data Sources filter by category and verify every source is explicitly not connected.
9. Resize to mobile; verify sidebar opens and navigates.
10. Test with network disabled; Google fonts may not load, but the rest of React app should remain usable. Use standalone HTML preview for an offline-native demonstration.
