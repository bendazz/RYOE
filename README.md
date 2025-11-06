# RYOE

## Data import to SQLite

This repo includes a helper script to import the combined team CSV into an SQLite database with numeric columns preserved as INTEGER/REAL.

### One-time setup

- Ensure Python 3.10+ is available
- (Optional) Install dependencies locally:

```bash
python3 -m pip install -r requirements.txt
```

### Convert CSV to SQLite

```bash
python3 scripts/csv_to_sqlite.py \
	--csv team_data_combined/team_data_combined.csv \
	--db team_data_combined/team_data_combined.db \
	--table team_data_combined
```

This will create `team_data_combined/team_data_combined.db` with one table named `team_data_combined`.

### Quick queries

```bash
sqlite3 -readonly team_data_combined/team_data_combined.db "SELECT COUNT(*) FROM team_data_combined;"
sqlite3 -readonly team_data_combined/team_data_combined.db "SELECT AVG(epa) FROM team_data_combined WHERE epa NOT NULL;"
sqlite3 -readonly team_data_combined/team_data_combined.db "PRAGMA table_info('team_data_combined');"
```

The schema uses INTEGER/REAL for numeric columns and TEXT for strings.

## Web app (front-end only)

This repo includes a tiny static web app (no frameworks) to look up a player's RYOE by name.

Files:
- `index.html` — UI markup (root)
- `app.js` — CSV loading, autocomplete, and display logic
- `styles.css` — minimal styling
- `RYOE.csv` — the data file the app reads

### Run locally

Because browsers block `file://` fetches, serve the folder over HTTP:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8000/
```

Start typing a player's name (e.g., `A.Davis`) to see suggestions; click or press Enter on an exact match to view their `yards_above_expected`.

### Top 10 by minimum rushes (Avg RYOE)

- Enter a number in "Minimum rushes" to filter players who have at least that many rushes.
- The app displays the Top 10 players by average `yards_above_expected` (Avg RYOE).
- Sorting is by Avg RYOE descending; ties preserve original order.

Note: If `RYOE.csv` includes a `rush_attempts` column, the app uses that value directly; otherwise, it falls back to counting rows per player and computing the average.
