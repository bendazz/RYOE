// Simple RYOE lookup web app (no frameworks)
(function () {
  const CSV_URL = 'RYOE.csv';

  const input = document.getElementById('player-input');
  const suggestionsEl = document.getElementById('suggestions');
  const resultEl = document.getElementById('result');
  const minRushesInput = document.getElementById('min-rushes');
  const top10El = document.getElementById('top10');

  /**
   * Parse CSV text into array of objects.
   * Handles commas inside double quotes and double-quote escaping.
   */
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];

    const headers = splitCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      if (!cols.length) continue;
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = cols[j] ?? '';
      }
      rows.push(row);
    }
    return rows;
  }

  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === ',') {
          result.push(current);
          current = '';
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }

  function formatNumber(x) {
    if (x == null || Number.isNaN(x)) return '—';
    return Number(x).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  function createSuggestionItem(player) {
    const div = document.createElement('div');
    div.className = 'suggestion';
    div.tabIndex = 0;
    div.innerHTML = `<span class="name">${escapeHtml(player.name)}</span>` +
      (player.id ? ` <span class="muted">(${escapeHtml(player.id)})</span>` : '');
    div.addEventListener('click', () => selectPlayer(player));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectPlayer(player);
      }
    });
    return div;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showSuggestions(list) {
    suggestionsEl.innerHTML = '';
    if (!list.length) {
      suggestionsEl.hidden = true;
      return;
    }
    list.forEach((p) => suggestionsEl.appendChild(createSuggestionItem(p)));
    suggestionsEl.hidden = false;
  }

  function hideSuggestions() {
    suggestionsEl.hidden = true;
  }

  function selectPlayer(player) {
    input.value = player.name;
    hideSuggestions();
    renderResult(player);
  }

  function renderResult(player) {
    resultEl.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="label">Player</div>
          <div class="value">${escapeHtml(player.name)}</div>
        </div>
        <div class="row">
          <div class="label">Rushes</div>
          <div class="value">${player.rushes ?? 1}</div>
        </div>
        <div class="row">
          <div class="label">Avg Yards Above Expected</div>
          <div class="value big">${formatNumber(player.avg)}</div>
        </div>
      </div>
    `;
  }

  function clearResult() {
    resultEl.textContent = '';
  }

  // State
  let players = []; // aggregated per player: {id, name, yards (total), rushes, avg}

  async function init() {
    try {
      const res = await fetch(CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch ${CSV_URL}: ${res.status}`);
      const text = await res.text();
  const rows = parseCSV(text);
  const hasRushAttempts = rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'rush_attempts');

      if (hasRushAttempts) {
        // CSV provides per-player average and attempts
        players = rows
          .map((r) => {
            const name = r.rusher_player_name;
            if (!name) return null;
            const id = r.rusher_player_id || '';
            const avgVal = r.yards_above_expected === undefined ? NaN : Number(r.yards_above_expected);
            const avg = Number.isFinite(avgVal) ? avgVal : 0;
            const rushes = Number(r.rush_attempts) || 0;
            return { id, name, rushes, avg };
          })
          .filter(Boolean);
      } else {
        // Fallback: aggregate by counting rows per player
        const byName = new Map();
        for (const r of rows) {
          const name = r.rusher_player_name;
          if (!name) continue;
          const id = r.rusher_player_id || '';
          const val = r.yards_above_expected === undefined ? NaN : Number(r.yards_above_expected);
          const yards = Number.isFinite(val) ? val : 0;
          const bucket = byName.get(name) || { id, name, yards: 0, rushes: 0 };
          if (!bucket.id && id) bucket.id = id;
          bucket.yards += yards;
          bucket.rushes += 1;
          byName.set(name, bucket);
        }
        players = Array.from(byName.values()).map(p => ({
          id: p.id,
          name: p.name,
          rushes: p.rushes,
          avg: p.rushes ? p.yards / p.rushes : 0
        }));
      }

      // Wire up interactions
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        clearResult();
        if (!q) { hideSuggestions(); return; }
        const matches = players.filter(p => p.name.toLowerCase().includes(q)).slice(0, 12);
        showSuggestions(matches);
      });

      input.addEventListener('keydown', (e) => {
        // If user hits Enter, try an exact (case-insensitive) match
        if (e.key === 'Enter') {
          const q = input.value.trim().toLowerCase();
          const exact = players.find(p => p.name.toLowerCase() === q);
          if (exact) {
            e.preventDefault();
            selectPlayer(exact);
          }
        }
        if (e.key === 'Escape') {
          hideSuggestions();
        }
      });

      document.addEventListener('click', (e) => {
        if (!suggestionsEl.contains(e.target) && e.target !== input) {
          hideSuggestions();
        }
      });

      // Top 10 list by min rushes
      function renderTop10(minRushes) {
        const minR = Number(minRushes) || 0;
        const top = players
          .filter(p => p.rushes >= minR)
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 10);
        if (!top.length) {
          top10El.innerHTML = '';
          return;
        }
        const rowsHtml = top.map(p => `
          <tr>
            <td class="tl">${escapeHtml(p.name)}</td>
            <td class="tr">${p.rushes}</td>
            <td class="tr">${formatNumber(p.avg)}</td>
          </tr>
        `).join('');
        top10El.innerHTML = `
          <div class="card">
            <div class="row"><div class="label">Top 10 by Avg RYOE</div><div class="value">(min rushes: ${minR})</div></div>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th class="tl">Player</th><th class="tr">Rushes</th><th class="tr">Avg RYOE</th></tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        `;
      }

      minRushesInput.addEventListener('input', () => {
        renderTop10(minRushesInput.value);
      });

      // initial
      if (minRushesInput) {
        minRushesInput.value = 10;
        renderTop10(10);
      }
    } catch (err) {
      console.error(err);
      resultEl.innerHTML = `<div class="error">${escapeHtml(String(err))}</div>`;
    }
  }

  init();
})();
