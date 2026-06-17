# AIonOS × BIRKENSTOCK Agentic Retail Command Center

A **backend-free, GitHub Pages-ready** static system that demonstrates the Birkenstock Agentic Retail POV using synthetic data, JSON storage, real-time browser simulation, and a premium HTML command center.

## What this system proves

This is built to support the AIonOS proposition for BIRKENSTOCK India:

- SAP, Shopify, POS, WMS and marketplace systems stay intact.
- A static connector/data layer simulates those feeds as JSON.
- A unified retail twin merges store, D2C and marketplace inventory.
- AI agent loops detect risk, recommend transfers, create mock SAP/WMS actions and preserve audit evidence.
- The entire system runs from static HTML/JS/CSS, so it can be uploaded directly to GitHub Pages.

## Client demo story

Use this flow for a 5-minute demo:

1. Open the Command Center.
2. Show the KPI strip: 50 stores, 3+ channels, revenue at risk, critical risks.
3. Click **Launch Mumbai Weekend Spike**.
4. Show Boston / Arizona / Gizeh stockout radar.
5. Open **Auditable Recommendations**.
6. Approve a transfer action.
7. Show mock SAP STO, WMS pick task, audit trail and ROI impact.
8. Export the state JSON to prove every screen is reproducible from data.

## Features included

- Real-time event stream in the browser.
- Scenario engine with synthetic Birkenstock-like pressure events.
- Hero SKU stockout radar for Arizona / Boston / Gizeh.
- Six agent loops:
  - Demand Sensing Agent
  - Allocation Agent
  - Replenishment Agent
  - Transfer Agent
  - Inventory Accuracy Agent
  - Returns Restock Agent
- Unified retail twin table.
- Agent recommendation and approval workflow.
- Mock SAP STO and WMS pick-task creation.
- AgentOps audit trail.
- JSON export/import to save and replay state.
- Data room with downloadable CSV “past data sheets.”

## Folder structure

```text
.
├── index.html
├── style.css
├── app.js
├── data/
│   ├── manifest.json
│   ├── stores.json
│   ├── sku_catalog.json
│   ├── channels.json
│   ├── warehouses.json
│   ├── inventory_snapshot.json
│   ├── sales_history.json
│   ├── historical_kpis.json
│   ├── inventory_variances.json
│   ├── returns_history.json
│   ├── scenarios.json
│   ├── agent_rules.json
│   ├── audit_log.json
│   └── sheets/
│       ├── stores.csv
│       ├── sku_catalog.csv
│       ├── inventory_snapshot.csv
│       ├── sales_history.csv
│       ├── historical_kpis.csv
│       ├── inventory_variances.csv
│       └── returns_history.csv
├── DEPLOYMENT.md
└── README.md
```

## Data model

The system is entirely JSON-backed. Key files:

- `inventory_snapshot.json`: synthetic SAP/POS/WMS/marketplace inventory positions.
- `sales_history.json`: synthetic historical offtake.
- `historical_kpis.json`: baseline fill-rate, stockout events, manual decisions and revenue-at-risk.
- `scenarios.json`: scenario definitions and demand multipliers.
- `agent_rules.json`: policy logic and guardrails.
- `audit_log.json`: baseline audit events.

The browser stores approved actions and current state in `localStorage` under:

```text
birkenstock_agentic_retail_state_v3
```

The user can also export/import the current state as JSON.

## Local preview

Because browsers usually block JSON fetch from `file://`, preview with a static server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

No backend, build step or node installation is required.

## GitHub Pages deployment

See `DEPLOYMENT.md`.

## Important note

All data is synthetic and created for demo purposes only. Replace JSON files with Birkenstock-approved pilot extracts when moving from demo to real pilot.
