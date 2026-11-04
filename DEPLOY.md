# Deploying pdfworks.io

Two deploy shapes live in this repo:

| | Free preview | Contabo VPS |
|---|---|---|
| Config | `render.yaml` | `docker-compose.prod.yml` |
| Processes | 1 container (`start.sh`, `DEPLOY_PROFILE=free`) | 6 containers |
| Redis | inside the container | own container |
| Database | SQLite on ephemeral disk | Postgres with a volume |
| Uploads | 10 MB | 20 MB (50 MB Pro) |
| Survives restart | no | yes |

---

## Contabo VPS

### 1. The box

**Cloud VPS 6** — 6 vCPU, 12 GB RAM, 100 GB **NVMe**. Take the NVMe option, not
the SSD one on Cloud VPS 4: every conversion writes a temp file, shells out to
ghostscript/libreoffice/ffmpeg, writes an output file and reads it back, so disk
I/O is the bottleneck that actually bites. Ubuntu 24.04 LTS.

Contabo's shared cores see steal time and land around 60–80% of Hetzner's
single-thread speed, so expect a conversion that took 30s to take 40–45s. The
concurrency numbers below are set for that, not for a dedicated-core box.

### 2. Base setup

```bash
adduser deploy && usermod -aG sudo deploy
# copy your key up, then disable password login:
#   PasswordAuthentication no, PermitRootLogin no  in /etc/ssh/sshd_config
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
```

Leave Coolify's dashboard port (8000) closed to the world — reach it over an SSH
tunnel, or restrict it to your own IP:

```bash
ufw allow from YOUR.IP.HERE to any port 8000
```

### 3. Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

It installs Docker and brings its own proxy up. Coolify needs ~2 GB, which is
why the limits in `docker-compose.prod.yml` stop at ~8.5 GB of the 12.

### 4. DNS

In Cloudflare, delete the records still pointing at the dead Hetzner box
(`188.245.99.222`) and add:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `pdfworks.io` | new Contabo IP | **DNS only** at first |
| A | `www` | new Contabo IP | **DNS only** at first |

Leave the proxy off until Coolify has issued a certificate. Then turn it on and
keep SSL/TLS on **Full (strict)**.

> This is what the old box died of. Cloudflare was set to Full (strict) against
> an origin that had stopped serving TLS, which surfaces as **error 525** —
> Cloudflare reaching the host fine and failing the handshake. If you ever see a
> 525 again, the origin is up but its certificate is gone, so check Coolify's
> proxy before you touch DNS.

### 5. Deploy

In Coolify: **New Resource → Docker Compose**, point it at this repo, and set the
compose file to `docker-compose.prod.yml`. Set the domain to `https://pdfworks.io`
on the `api` service so the proxy routes port 8000 there.

Environment: copy `.env.example` into Coolify's editor and fill it in.
`POSTGRES_PASSWORD` has no default and compose refuses to start without it.
`SECRET_KEY` wants `openssl rand -hex 32`.

Two values are easy to get wrong:

- `REDIS_URL=redis://redis:6379/0` — the compose service name. `127.0.0.1` only
  works in the single-container free profile.
- `ALLOWED_ORIGINS` is **comma-separated**, not a JSON array. `app/main.py`
  splits on commas; a JSON array parses into malformed origins and silently
  falls back to a hardcoded default.

### 6. Check it

```bash
curl -s https://pdfworks.io/health                    # {"status":"ok"}
curl -s https://pdfworks.io/sitemap.xml | grep -c '<loc>'   # ~30
docker compose -f docker-compose.prod.yml ps          # all six up
```

Then put a real file through a tool page and confirm the download — that is the
only check that proves Redis, a worker and the shared `fileconvert_tmp` volume
are all wired together. If a job sits at `queued` forever the workers cannot
reach Redis; if it reaches `done` but the download 404s, `UPLOAD_DIR` /
`OUTPUT_DIR` do not match the shared volume mount.

### 7. Tuning later

`worker-default` runs 3 slots and `worker-heavy` 1. Raise `worker-default` to 4
if PDF jobs queue up. Leave `worker-heavy` at 1 — ffmpeg already threads
internally, and extra slots on shared cores make every job slower rather than
finishing more of them.

---

## Free preview (Render)

**New → Blueprint** against this repo; `render.yaml` describes one free web
service. Nothing else is needed — no managed Redis, no managed Postgres.

What you give up: 512 MB / 0.1 CPU, no persistent disk (the job table resets on
every deploy and every spin-down), and a spin-down after 15 minutes idle with a
~1 minute cold start. Verified working at 224 MiB peak with LibreOffice
conversions, so it is a usable preview box — just not somewhere to send traffic.
