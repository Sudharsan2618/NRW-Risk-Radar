# Deploy to AWS — Elastic Beanstalk (Console, step‑by‑step)

Manual, click-through steps to run the NRW Wildfire Radar on **AWS Elastic
Beanstalk** using only the AWS Console (no terminal commands).

**Why Elastic Beanstalk:** the app is a long‑running Python HTTP server (not a
static site / not serverless), so it needs a service that runs a persistent
process with a managed load balancer, health checks and auto‑scaling. With App
Runner unavailable to you, Elastic Beanstalk is the right managed fit — it runs
the process defined in the repo's `Procfile`.

> Steps validated against the current AWS Elastic Beanstalk documentation
> (Create‑environment wizard; "Configuring the WSGI server with a Procfile" —
> which states the app port defaults to **8000** and that you must set the
> `PORT` environment property if you use a different port).

---

## What makes this work (already in the repo)
- **`Procfile`** → `web: python apps/api/main.py` (tells Beanstalk how to start the server).
- **`requirements.txt`** → present (no third‑party packages) so Beanstalk detects Python.
- The server reads the **`PORT`** environment variable, so we point it at Beanstalk's expected port (8000).

You do **not** need Docker for this path.

---

## Step 0 — Prepare the source bundle (the only non‑console step)

Beanstalk's console needs a `.zip` whose files are at the **root** of the
archive (the `Procfile` must be at the top level, not inside a subfolder).

1. Open the public repo: **https://github.com/Sudharsan2618/NRW-Risk-Radar**
2. Click **Code ▸ Download ZIP**. (GitHub's zip contains only committed files —
   no `.env`, no secrets, no `.venv`.)
3. **Extract** the downloaded zip. You'll get a folder like `NRW-Risk-Radar-main`.
4. **Open that folder**, select **all files inside it** (`Ctrl+A`) — you should
   see `Procfile`, `requirements.txt`, `apps`, `analytics`, `data`, etc. at the
   top.
5. Right‑click ▸ **Send to ▸ Compressed (zipped) folder**. Name it
   `radar-source.zip`.
   ✅ Correct: opening `radar-source.zip` shows `Procfile` immediately.
   ❌ Wrong: it shows a single `NRW-Risk-Radar-main` folder — re‑zip from *inside* the folder.

(The source bundle size limit is 500 MB — this app is well under it.)

---

## Step 1 — Open Elastic Beanstalk and start the wizard
1. Sign in to the **AWS Management Console**.
2. Top‑right: pick your **Region** (e.g. **Europe (Frankfurt) eu‑central‑1** — closest to the German data sources).
3. Search for **Elastic Beanstalk** ▸ open it.
4. Click **Create application** (this opens the **Create environment** wizard).

## Step 2 — Environment tier
- Choose **Web server environment**.

## Step 3 — Application information
- **Application name:** `nrw-wildfire-radar`

## Step 4 — Environment information
- **Name:** accept the generated name (e.g. `nrw-wildfire-radar-env`) or set your own.
- **Domain:** leave default, or type a subdomain and click **Check Availability** (this becomes `http://<domain>.<region>.elasticbeanstalk.com`).
- **Description:** optional.

## Step 5 — Platform
- **Platform type:** **Managed platform**.
- **Platform:** **Python**.
- **Platform branch:** the latest **Python … running on 64bit Amazon Linux 2023** (e.g. Python 3.13 on AL2023).
- **Platform version:** leave the **Recommended** version selected.

## Step 6 — Application code
- Select **Upload your code**.
- **Version label:** e.g. `v1`.
- Click **Upload** ▸ **Local file** ▸ choose `radar-source.zip` from Step 0 ▸ **Upload**.

## Step 7 — Presets (capacity)
- **Single instance (free tier eligible)** — cheapest, good for a demo/staging.
  *(Choose **High availability** instead if you want a load balancer and multiple instances; it costs more.)*
- Click **Next**.

## Step 8 — Configure service access
- **Service role:** choose **Use an existing service role** if one exists, otherwise **Create and use new service role** (default name `aws-elasticbeanstalk-service-role`).
- **EC2 instance profile:** select an existing one if present. If the dropdown is **empty**, create it first:
  1. Open **IAM** (new browser tab) ▸ **Roles** ▸ **Create role**.
  2. **Trusted entity type:** **AWS service**.
  3. **Use case:** **Elastic Beanstalk – Compute** ▸ **Next**.
  4. Confirm these managed policies are attached, then **Next**:
     - `AWSElasticBeanstalkWebTier`
     - `AWSElasticBeanstalkWorkerTier`
     - `AWSElasticBeanstalkMulticontainerDocker`
  5. Name it e.g. `aws-elasticbeanstalk-ec2-role` ▸ **Create role**.
  6. Back in the Beanstalk wizard, **refresh** the **EC2 instance profile** dropdown and select it.
- **EC2 key pair:** optional (only if you want SSH access).
- Click **Next**.

## Step 9 — Set up networking, database, and tags
- Leave defaults (Beanstalk uses your default VPC). Click **Next**.
  *(No database is needed — this app has none.)*

## Step 10 — Configure instance traffic and scaling
- Leave defaults. **If** you chose High availability (a load balancer), set the
  **Health check path** to `/` under the load balancer/process settings.
- Click **Next**.

## Step 11 — Configure updates, monitoring, and logging → **Environment properties**
Scroll to **Environment properties** and add these key/value pairs (this is how
your app gets its settings — it replaces the local `.env`):

| Name | Value |
| ---- | ----- |
| `PORT` | `8000` |
| `DATA_MODE` | `live`  *(use `demo` to skip all the URLs below)* |
| `NINA_MAX_WARNINGS` | `10` |
| `NINA_INDEX_MAX_WARNINGS` | `50` |
| `DWD_URL` | `https://services2.arcgis.com/7wuv6DH7DYhDuwvU/ArcGIS/rest/services/DWD/FeatureServer/3/query?where=1%3D1&outFields=*&f=json` |
| `NINA_URL` | `https://warnung.bund.de/api31/dashboard/053580000000.json` |
| `NINA_INDEX_URL` | `https://warnung.bund.de/api31/mowas/mapData.json` |
| `EFFIS_URL` | `https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=1.0.0&request=GetFeature&typename=ms%3Amodis.ba.poly.today&outputformat=geojson&bbox=5%2C50%2C7%2C52` |
| `FIRMS_URL` | *paste from your local `.env` — contains your NASA FIRMS map key* |
| `FIRMS_NATIONWIDE_URL` | *paste from your local `.env` — contains your NASA FIRMS map key* |

> ⚠️ The two `FIRMS_*` URLs embed your NASA map key — keep them **only** here in
> Beanstalk, never in the public repo or this file.

- Click **Next**.

## Step 12 — Review and create
- Review the summary, then click **Submit** / **Create environment**.
- Beanstalk provisions the environment (~3–8 min). Wait for **Health: Ok (green)**.
- Click the environment **Domain** link at the top → you should see the **mock
  login** → sign in → the radar with live events.

---

## Updating the app later
Any of these work:
- **Manual:** repeat Step 0 to make a fresh `radar-source.zip`, then in the
  environment click **Upload and deploy** ▸ choose the zip ▸ **Deploy**.
- **Auto‑deploy from GitHub (optional):** create an **AWS CodePipeline** with
  **Source = GitHub** (connect the public repo, branch `main`), **skip the build
  stage**, and **Deploy = AWS Elastic Beanstalk** (select this application +
  environment). Every push to `main` then redeploys automatically.

---

## Troubleshooting
- **502 / "502 Bad Gateway" or health goes red:** almost always the port. Confirm
  the **`PORT` environment property is `8000`** (Step 11). The nginx reverse
  proxy forwards to 8000; the app must bind it.
- **First load is slow / health flaps once at start:** in live mode the app
  fetches the external feeds at boot (~10–30s). It settles to green after that.
- **See logs:** environment page ▸ **Logs** ▸ **Request logs ▸ Last 100 lines**
  (or **Full logs**).
- **A data source shows "Sample data" in the app:** that source URL is unset or
  unreachable — re‑check the corresponding environment property.

## Cost note
A **Single instance** on a small type (e.g. `t3.small`) is roughly **~$15/month**;
choose High availability (adds an Application Load Balancer, ~$16+/mo) only when
you need production resilience. Remember to **delete the environment** when you're
done to stop charges (environment page ▸ **Actions ▸ Terminate environment**).
