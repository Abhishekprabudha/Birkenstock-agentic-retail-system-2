# Deployment Guide — GitHub Pages

## Option 1: Upload through GitHub web UI

1. Create a new GitHub repository, for example:

   ```text
   birkenstock-agentic-retail-system
   ```

2. Upload all files and folders from this ZIP to the repository root.

3. Go to:

   ```text
   Settings → Pages
   ```

4. Under **Build and deployment**, select:

   ```text
   Source: Deploy from a branch
   Branch: main
   Folder: /root
   ```

5. Save.

6. Open the generated GitHub Pages URL.

## Option 2: Git command line

```bash
git init
git add .
git commit -m "Add Birkenstock agentic retail command center"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

Then enable GitHub Pages from repository settings.

## No backend required

This system runs fully in the browser:

- Static HTML/CSS/JS
- Static JSON data files
- Browser localStorage for state persistence
- JSON export/import for replayability

## Updating data later

Replace any file in `/data` with real pilot-approved extracts while keeping the same field names.

Recommended real pilot feeds:

- SAP inventory export → `inventory_snapshot.json`
- Shopify orders → `sales_history.json`
- POS store offtake → `sales_history.json`
- WMS available stock → `inventory_snapshot.json`
- Marketplace orders → `sales_history.json`

## Demo reset

Use the **Reset Demo** button in the UI to clear browser state and reload the original JSON baseline.
