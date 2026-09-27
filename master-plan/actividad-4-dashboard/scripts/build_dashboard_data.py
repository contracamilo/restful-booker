#!/usr/bin/env python3
"""Inserta en dashboard/index.html los datos consolidados en los CSV de data/.

Flujo de datos del dashboard:
    results/ (A3) -> data/*.csv -> este script -> dashboard/index.html

Los datos quedan dentro de index.html, entre los marcadores BEGIN/END DATA, para
que el dashboard sea un único archivo que se abre con doble clic, sin servidor
y sin depender de otros archivos.

Uso (desde master-plan/actividad-4-dashboard/):
    python3 scripts/build_dashboard_data.py
"""
import csv
import json
import re
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
HTML = BASE / "dashboard" / "index.html"
BEGIN = "/* BEGIN DATA: generado por scripts/build_dashboard_data.py, no editar a mano */"
END = "/* END DATA */"

SLO = {"p95": 800, "p99": 1500, "error": 1, "throughput": 150, "cpu_ref": 80}


def num(value):
    return None if value in ("", None) else round(float(value), 4)


def read_csv(name):
    with open(DATA / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_kpis():
    return [
        {
            "profile": r["profile"],
            "vus": int(r["vus_max"]),
            "duration": r["duration"],
            "p50": num(r["p50_ms"]),
            "p95": num(r["p95_ms"]),
            "p99": num(r["p99_ms"]),
            "throughput": num(r["throughput_req_s"]),
            "error": num(r["error_rate_pct"]),
            "p99Source": r["fuente_p99"],
        }
        for r in read_csv("kpis_rendimiento.csv")
    ]


def load_resources(name):
    return [
        {
            "time": r["time"],
            "cpu": num(r["cpu_pct"]),
            "ram": num(r["ram_mib"]),
            "netIn": num(r["net_in_mb"]),
            "netOut": num(r["net_out_mb"]),
            "blockRead": num(r.get("block_read_mb")),
            "blockWrite": num(r.get("block_write_mb")),
        }
        for r in read_csv(name)
    ]


def main():
    payload = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "sources": [
            "data/kpis_rendimiento.csv",
            "data/recursos_breakpoint.csv",
            "data/recursos_soak.csv",
        ],
        "slo": SLO,
        "kpis": load_kpis(),
        "resources": {
            "breakpoint": load_resources("recursos_breakpoint.csv"),
            "soak": load_resources("recursos_soak.csv"),
        },
    }
    block = BEGIN + "\nwindow.DASHBOARD_DATA = " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n" + END
    html = HTML.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
    if not pattern.search(html):
        raise SystemExit("No se encontraron los marcadores BEGIN/END DATA en dashboard/index.html")
    HTML.write_text(pattern.sub(lambda _: block, html), encoding="utf-8")
    print(f"Datos actualizados en {HTML.relative_to(BASE)} ({len(payload['kpis'])} perfiles)")


if __name__ == "__main__":
    main()
