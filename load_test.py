#!/usr/bin/env python3
"""
Generador de carga para Cheapest (Lab 2 / Lab 3).

Modelo de carga
---------------
- `--users` usuarios virtuales arrancan escalonados de forma uniforme durante `--ramp-up` s.
- Cada usuario envia una peticion cada `--think-time` s (por defecto = ramp-up, minimo 1 s),
  asi el throughput en regimen estable es ~ users / think-time = users / ramp-up. Eso coincide
  con la columna "Throughput objetivo" de la matriz (p. ej. 18000 / 200 s = 90 req/s).
- La prueba dura ramp-up + `--duration` s: durante el ramp-up la tasa sube linealmente y
  luego se sostiene `--duration` s. Si el servidor tarda mas que el think-time, el usuario
  envia la siguiente peticion apenas termina (bucle cerrado), como un usuario real.
- Error = status >= 400 + timeouts + errores de conexion.

Dependencia: pip install httpx   (matplotlib es opcional, solo para las graficas)

Ejemplos
--------
  python load_test.py --base-url http://localhost:3000 --endpoint GET --users 1500 --ramp-up 75 --duration 60
  python load_test.py --base-url http://<DNS_ALB> --endpoint POST --users 3000 --ramp-up 100 --duration 60 --tag run1
"""
import argparse
import asyncio
import csv
import json
import random
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("Falta httpx. Instala con: pip install httpx")

GET_PATH = "/logistics/tenderos/productos-disponibles"
POST_PATH = "/logistics/pedidos"
DEFAULT_TIENDA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
DEFAULT_MONEDA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
MIN_ITEMS = 25  # "pedido grande" (> 20 items)


# --------------------------------------------------------------------------- args
def parse_args():
    p = argparse.ArgumentParser(description="Prueba de carga HTTP para Cheapest (GET o POST).")
    p.add_argument("--base-url", default="http://localhost:3000",
                   help="Local: http://localhost:3000 | AWS: http://<DNS_ALB> (puerto 80)")
    p.add_argument("--endpoint", required=True, choices=["GET", "POST"], type=str.upper,
                   help="GET = productos-disponibles, POST = crear pedido")
    p.add_argument("--users", type=int, required=True, help="Usuarios virtuales (threads)")
    p.add_argument("--ramp-up", type=float, required=True, help="Segundos para lanzar todos los usuarios")
    p.add_argument("--duration", type=float, default=60, help="Segundos sostenidos despues del ramp-up (def. 60)")
    p.add_argument("--think-time", type=float, default=None,
                   help="Segundos entre peticiones de un mismo usuario (def. = ramp-up, min 1)")
    p.add_argument("--body", default=None,
                   help="POST: JSON con el pedido base. Se reemplazan identificador y fechaHoraCreacion en cada request")
    p.add_argument("--tienda-id", default=DEFAULT_TIENDA)
    p.add_argument("--zona", default="Zona Norte")
    p.add_argument("--moneda-id", default=DEFAULT_MONEDA)
    p.add_argument("--product-ids", default=None,
                   help="POST: archivo con un productoId por linea. Si se omite, se obtienen con un GET previo")
    p.add_argument("--timeout", type=float, default=30, help="Timeout por request en s (def. 30)")
    p.add_argument("--max-connections", type=int, default=5000,
                   help="Tope de conexiones simultaneas del cliente (def. 5000). Sube ulimit -n si lo aumentas")
    p.add_argument("--tag", default="", help="Sufijo para los archivos de salida (p. ej. run1)")
    p.add_argument("--output-dir", default=".", help="Carpeta de salida (CSV, graficas, summary.csv)")
    p.add_argument("--no-plots", action="store_true", help="No generar graficas")
    a = p.parse_args()
    if a.users < 1 or a.ramp_up <= 0 or a.duration < 0:
        p.error("users >= 1, ramp-up > 0 y duration >= 0")
    if a.think_time is None:
        a.think_time = max(a.ramp_up, 1.0)
    return a


# ------------------------------------------------------------------------ request builders
def load_product_ids(args, client_sync_get):
    """IDs de producto validos para el POST: archivo, o los que devuelve el GET de tendero."""
    if args.product_ids:
        ids = [l.strip() for l in Path(args.product_ids).read_text().splitlines() if l.strip()]
    else:
        ids = client_sync_get()
    if not ids:
        sys.exit("No hay productoId validos. Pasa --product-ids archivo.txt "
                 "(SELECT id FROM productos LIMIT 50) o verifica que el GET devuelva productos.")
    if len(ids) < MIN_ITEMS:
        print(f"[aviso] solo hay {len(ids)} productoId; el pedido repetira productos para llegar a {MIN_ITEMS} items.")
    return ids


def make_post_body(args, product_ids, base_body):
    now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if base_body is not None:
        body = json.loads(json.dumps(base_body))  # copia profunda
        body["identificador"] = f"PED-{uuid.uuid4().hex[:24]}"
        body["fechaHoraCreacion"] = now
        return body
    n = max(MIN_ITEMS, 1)
    chosen = [product_ids[i % len(product_ids)] for i in range(n)] if len(product_ids) < n \
        else random.sample(product_ids, n)
    items, total = [], 0
    for pid in chosen:
        cantidad = random.randint(1, 5)
        precio = random.choice([5000, 8500, 12000, 20000])
        total += cantidad * precio
        items.append({"productoId": pid, "cantidad": cantidad, "precioUnitario": precio,
                      "descuento": 0, "monedaId": args.moneda_id})
    return {
        "identificador": f"PED-{uuid.uuid4().hex[:24]}",   # unico por request (evita falsos errores por duplicado)
        "tiendaId": args.tienda_id,
        "fechaHoraCreacion": now,
        "montoTotal": total,
        "monedaId": args.moneda_id,
        "estado": "creado",
        "items": items,
    }


# ------------------------------------------------------------------------------ load loop
async def one_request(client, args, record, product_ids, base_body):
    ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    status, error = 0, ""
    t = time.perf_counter()
    try:
        if args.endpoint == "GET":
            r = await client.get(GET_PATH, params={"tiendaId": args.tienda_id, "zona": args.zona})
        else:
            r = await client.post(POST_PATH, json=make_post_body(args, product_ids, base_body))
        status = r.status_code
        if status >= 400:
            error = f"HTTP {status}"
    except httpx.TimeoutException:
        error = "timeout"
    except httpx.ConnectError as e:
        error = f"connect_error: {type(e).__name__}"
    except httpx.HTTPError as e:
        error = f"http_error: {type(e).__name__}"
    except Exception as e:  # noqa: BLE001 - registrar cualquier fallo como error de la peticion
        error = f"error: {type(e).__name__}"
    latency_ms = (time.perf_counter() - t) * 1000
    record.append((ts, status, round(latency_ms, 2), error))


async def virtual_user(idx, args, client, record, t0, product_ids, base_body):
    start = idx * args.ramp_up / args.users
    end = args.ramp_up + args.duration
    await asyncio.sleep(max(0.0, t0 + start - time.perf_counter()))
    k = 0
    while True:
        scheduled = t0 + start + k * args.think_time
        if scheduled - t0 >= end:
            break
        wait = scheduled - time.perf_counter()
        if wait > 0:
            await asyncio.sleep(wait)
        await one_request(client, args, record, product_ids, base_body)
        k += 1


async def run(args, product_ids, base_body):
    limits = httpx.Limits(max_connections=args.max_connections,
                          max_keepalive_connections=args.max_connections)
    timeout = httpx.Timeout(args.timeout, connect=args.timeout, pool=args.timeout)
    record = []
    async with httpx.AsyncClient(base_url=args.base_url, limits=limits, timeout=timeout) as client:
        t0 = time.perf_counter() + 0.2
        wall0 = time.time() + 0.2
        tasks = [asyncio.create_task(virtual_user(i, args, client, record, t0, product_ids, base_body))
                 for i in range(args.users)]
        total = args.ramp_up + args.duration
        ticker = asyncio.create_task(progress(t0, total, record))
        await asyncio.gather(*tasks)
        ticker.cancel()
    return record, wall0, time.time()


async def progress(t0, total, record):
    try:
        while True:
            await asyncio.sleep(5)
            el = time.perf_counter() - t0
            errs = sum(1 for r in record if r[3])
            print(f"  t={el:6.1f}/{total:.0f}s  requests={len(record):>7}  errores={errs}", flush=True)
    except asyncio.CancelledError:
        pass


# --------------------------------------------------------------------------------- stats
def percentile(sorted_vals, p):
    if not sorted_vals:
        return 0.0
    k = max(0, min(len(sorted_vals) - 1, int(-(-p / 100 * len(sorted_vals) // 1)) - 1))  # nearest-rank
    return sorted_vals[k]


def summarize(record, wall0, wall1):
    lat = sorted(r[2] for r in record)
    n = len(record)
    errs = sum(1 for r in record if r[3])
    first = min((datetime.fromisoformat(r[0]).timestamp() for r in record), default=wall0)
    elapsed = max(wall1 - first, 1e-9)
    return {
        "total": n, "errors": errs,
        "error_pct": round(100 * errs / n, 2) if n else 0.0,
        "throughput": round(n / elapsed, 2),
        "avg_ms": round(sum(lat) / n, 2) if n else 0.0,
        "p95_ms": round(percentile(lat, 95), 2),
        "p99_ms": round(percentile(lat, 99), 2),
        "min_ms": round(lat[0], 2) if n else 0.0,
        "max_ms": round(lat[-1], 2) if n else 0.0,
        "elapsed_s": round(elapsed, 1),
    }


def error_breakdown(record):
    out = {}
    for r in record:
        if r[3]:
            out[r[3]] = out.get(r[3], 0) + 1
    return out


# --------------------------------------------------------------------------------- output
def write_outputs(args, record, s):
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    suffix = f"_{args.tag}" if args.tag else ""
    name = "results_get" if args.endpoint == "GET" else "results_post"
    csv_path = out / f"{name}{suffix}.csv"
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp_iso", "status_code", "latency_ms", "error"])
        w.writerows(sorted(record, key=lambda r: r[0]))

    summary_path = out / "summary.csv"
    new = not summary_path.exists()
    with open(summary_path, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["run", "endpoint", "users", "ramp_up_s", "duration_s", "total", "throughput_rps",
                        "avg_ms", "p95_ms", "p99_ms", "error_pct", "base_url"])
        w.writerow([args.tag or csv_path.stem, args.endpoint, args.users, args.ramp_up, args.duration,
                    s["total"], s["throughput"], s["avg_ms"], s["p95_ms"], s["p99_ms"], s["error_pct"],
                    args.base_url])

    plots = []
    if not args.no_plots:
        plots = make_plots(args, record, out, f"{name}{suffix}")
    return csv_path, summary_path, plots


def make_plots(args, record, out, stem):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("[aviso] matplotlib no instalado; se omiten las graficas (pip install matplotlib).")
        return []
    if not record:
        return []
    rows = sorted(record, key=lambda r: r[0])
    t0 = datetime.fromisoformat(rows[0][0]).timestamp()
    xs = [datetime.fromisoformat(r[0]).timestamp() - t0 for r in rows]
    ys = [r[2] for r in rows]
    bad = [bool(r[3]) for r in rows]

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.scatter([x for x, b in zip(xs, bad) if not b], [y for y, b in zip(ys, bad) if not b],
               s=4, alpha=0.4, label="OK")
    ax.scatter([x for x, b in zip(xs, bad) if b], [y for y, b in zip(ys, bad) if b],
               s=6, alpha=0.7, color="red", label="Error")
    if args.endpoint == "GET":
        ax.axhline(1000, color="gray", linestyle="--", linewidth=1, label="ASR 1: 1000 ms")
    ax.set_xlabel("Segundos desde el primer request")
    ax.set_ylabel("Latencia (ms)")
    ax.set_title(f"Latencia {args.endpoint} - {args.users} users, ramp-up {args.ramp_up:g}s")
    ax.legend()
    fig.tight_layout()
    p1 = out / f"{stem}_latencia.png"
    fig.savefig(p1, dpi=130)
    plt.close(fig)

    secs = {}
    for x, b in zip(xs, bad):
        sec = int(x)
        ok, er = secs.get(sec, (0, 0))
        secs[sec] = (ok + (not b), er + b)
    keys = sorted(secs)
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.bar(keys, [secs[k][0] for k in keys], label="OK")
    ax.bar(keys, [secs[k][1] for k in keys], bottom=[secs[k][0] for k in keys], color="red", label="Error")
    ax.set_xlabel("Segundo de la prueba")
    ax.set_ylabel("Requests completados por segundo")
    ax.set_title(f"Throughput {args.endpoint}")
    ax.legend()
    fig.tight_layout()
    p2 = out / f"{stem}_throughput.png"
    fig.savefig(p2, dpi=130)
    plt.close(fig)
    return [p1, p2]


# ----------------------------------------------------------------------------------- main
def main():
    args = parse_args()
    base_body = json.loads(Path(args.body).read_text()) if args.body else None

    product_ids = []
    if args.endpoint == "POST":
        def fetch_ids():
            try:
                r = httpx.get(args.base_url + GET_PATH,
                              params={"tiendaId": args.tienda_id, "zona": args.zona}, timeout=60)
                r.raise_for_status()
                return [p["id"] for p in r.json()][:200]
            except Exception as e:  # noqa: BLE001
                print(f"[aviso] no pude obtener productoId del GET: {e}")
                return []
        if base_body is None:
            product_ids = load_product_ids(args, fetch_ids)

    total = args.ramp_up + args.duration
    print(f"{args.endpoint} {args.base_url} | users={args.users} ramp-up={args.ramp_up:g}s "
          f"duration={args.duration:g}s think-time={args.think_time:g}s "
          f"(throughput objetivo ~ {args.users / args.think_time:.1f} req/s) | duracion total ~{total:g}s")

    record, wall0, wall1 = asyncio.run(run(args, product_ids, base_body))
    s = summarize(record, wall0, wall1)
    csv_path, summary_path, plots = write_outputs(args, record, s)

    print("\n================ RESUMEN ================")
    print(f"Endpoint        : {args.endpoint}")
    print(f"Total requests  : {s['total']}")
    print(f"Duracion real   : {s['elapsed_s']} s")
    print(f"Throughput      : {s['throughput']} req/s")
    print(f"Latencia prom.  : {s['avg_ms']} ms  (min {s['min_ms']} / max {s['max_ms']})")
    print(f"Latencia p95    : {s['p95_ms']} ms")
    print(f"Latencia p99    : {s['p99_ms']} ms")
    print(f"Error %         : {s['error_pct']}  ({s['errors']} de {s['total']})")
    for k, v in sorted(error_breakdown(record).items(), key=lambda kv: -kv[1]):
        print(f"   - {k}: {v}")
    if args.endpoint == "GET":
        print(f"ASR 1 (p99 < 1000 ms): {'CUMPLE' if s['p99_ms'] < 1000 else 'NO CUMPLE'}")
        if s["error_pct"] > 0:
            print("  OJO: hubo errores; las peticiones fallidas suelen ser rapidas y bajan el p99 "
                  "artificialmente. Revisa el desglose antes de dar el p99 por valido.")
    else:
        print(f"ASR 2 (error % <= 2): {'CUMPLE' if s['error_pct'] <= 2 else 'NO CUMPLE'}")
    print(f"CSV: {csv_path}\nResumen acumulado: {summary_path}")
    for p in plots:
        print(f"Grafica: {p}")


if __name__ == "__main__":
    main()
