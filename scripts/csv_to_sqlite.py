#!/usr/bin/env python3
"""
Load a CSV into an SQLite database using pandas, doing best-effort numeric type inference.

Usage:
  python scripts/csv_to_sqlite.py \
    --csv team_data_combined/team_data_combined.csv \
    --db team_data_combined/team_data_combined.db \
    --table team_data_combined
"""

from __future__ import annotations

import argparse
import os
import sys
import sqlite3
import pandas as pd


def infer_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Attempt to convert object/string columns to numeric when safe.

    Strategy:
    - Keep pandas' default inference for already-numeric columns.
    - For object/string columns, try to parse to numeric with errors='coerce'.
      If at least 95% of non-null values parse successfully, adopt the numeric conversion.
    This avoids converting mostly-text columns (like team abbreviations) to NaN.
    """
    obj_cols = [c for c in df.columns if df[c].dtype == "object"]
    if not obj_cols:
        return df

    for col in obj_cols:
        s = df[col]
        # Skip short/ID-like columns quickly
        if s.empty:
            continue
        # Try numeric conversion
        numeric = pd.to_numeric(s, errors="coerce")
        # Compute share of values that converted to a number among non-null inputs
        non_null = s.notna()
        if non_null.any():
            success_rate = numeric.notna().sum() / non_null.sum()
            if success_rate >= 0.95:
                df[col] = numeric
    return df


def load_csv_to_sqlite(csv_path: str, db_path: str, table_name: str) -> None:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    # Read CSV with robust type inference
    df = pd.read_csv(
        csv_path,
        low_memory=False,  # allow proper type inference over entire columns
        na_values=["", "NA", "NaN", "null", "None"],
        keep_default_na=True,
    )

    # Use pandas' native dtype inference (nullable dtypes when available)
    try:
        df = df.convert_dtypes()
    except Exception:
        # Older pandas fallback; safe to ignore
        pass

    # Best-effort conversion of string/object columns into numeric when appropriate
    df = infer_numeric_columns(df)

    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        df.to_sql(table_name, conn, if_exists="replace", index=False)
    finally:
        conn.commit()
        conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import CSV into SQLite with numeric types.")
    parser.add_argument("--csv", required=True, help="Path to the input CSV file")
    parser.add_argument("--db", required=True, help="Output SQLite DB path")
    parser.add_argument("--table", required=True, help="Table name to create/replace")
    args = parser.parse_args(argv)

    load_csv_to_sqlite(args.csv, args.db, args.table)
    print(f"Imported {args.csv} -> {args.db}:{args.table}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
