# Continuous Deployment to AWS (GitHub → CodePipeline → Elastic Beanstalk)

Auto-deploy setup — **no zipping, no uploads**. Once configured, every push to
the GitHub `main` branch is built into a version and deployed automatically.

```
 git push  ──▶  GitHub (Sudharsan2618/NRW-Risk-Radar, main)
                     │  (AWS CodeConnections GitHub App detects the push)
                     ▼
              AWS CodePipeline  ── Source stage ──▶ Deploy stage
                     ▼
        AWS Elastic Beanstalk environment (runs the Python server)
```

> Validated against current AWS docs: the Elastic Beanstalk **Create environment**
> wizard, **"Create a pipeline (console)"**, and **"GitHub connections"** (the
> *GitHub (via GitHub App)* provider + *AWS Connector for GitHub* app). The
> Python platform's reverse proxy forwards to **port 8000**, and the docs say to
> set the **`PORT` environment property** when your app uses a different port —
> which is why Part 1 sets `PORT=8000`.

**Do this in the region Europe (Frankfurt) `eu-central-1`** (close to the German
data feeds, and GitHub connections are supported there).

---

# Part 1 — Create the Elastic Beanstalk environment (once, no upload)

1. AWS Console → set region **Europe (Frankfurt) eu-central-1** (top-right).
2. Open **Elastic Beanstalk** → **Create application**.
3. **Environment tier:** **Web server environment**.
4. **Application information → Application name:** `nrw-wildfire-radar`.
5. **Environment information → Name:** accept the default (e.g. `nrw-wildfire-radar-env`). Note this name — the pipeline needs it.
6. **Platform:**
   - **Platform type:** **Managed platform**
   - **Platform:** **Python**
   - **Platform branch:** latest **Python … on 64bit Amazon Linux 2023**
   - **Platform version:** **Recommended** (leave default)
7. **Application code:** choose **Sample application**. *(This is the trick that avoids any zip — the pipeline will replace it with your real code in Part 2.)*
8. **Presets:** **Single instance (free tier eligible)**. *(Choose High availability only if you want a load balancer / production resilience.)* → **Next**
9. **Configure service access:**
   - **Service role:** **Create and use new service role** (default `aws-elasticbeanstalk-service-role`), or pick an existing one.
   - **EC2 instance profile:** pick an existing one. If the list is **empty**, create it (new tab → **IAM → Roles → Create role → AWS service → Use case: Elastic Beanstalk – Compute → Next**, keep policies `AWSElasticBeanstalkWebTier`, `AWSElasticBeanstalkWorkerTier`, `AWSElasticBeanstalkMulticontainerDocker` → name it `aws-elasticbeanstalk-ec2-role` → **Create role**), then **refresh** and select it. → **Next**
10. **Set up networking, database, and tags:** leave defaults → **Next**.
11. **Configure instance traffic and scaling:** leave defaults → **Next**.
12. **Configure updates, monitoring, and logging → Environment properties** — add these key/value pairs:

    | Name | Value |
    | ---- | ----- |
    | `PORT` | `8000` |
    | `DATA_MODE` | `live`  *(or `demo` to skip all URLs)* |
    | `NINA_MAX_WARNINGS` | `10` |
    | `NINA_INDEX_MAX_WARNINGS` | `50` |
    | `DWD_URL` | `https://services2.arcgis.com/7wuv6DH7DYhDuwvU/ArcGIS/rest/services/DWD/FeatureServer/3/query?where=1%3D1&outFields=*&f=json` |
    | `NINA_URL` | `https://warnung.bund.de/api31/dashboard/053580000000.json` |
    | `NINA_INDEX_URL` | `https://warnung.bund.de/api31/mowas/mapData.json` |
    | `EFFIS_URL` | `https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=1.0.0&request=GetFeature&typename=ms%3Amodis.ba.poly.today&outputformat=geojson&bbox=5%2C50%2C7%2C52` |
    | `FIRMS_URL` | *paste from your local `.env` (has your NASA map key)* |
    | `FIRMS_NATIONWIDE_URL` | *paste from your local `.env` (has your NASA map key)* |

    > These are environment-level, so they persist across every future deploy.
    > Keep the two `FIRMS_*` values only here — never in the public repo.

13. → **Next** → **Submit**. Wait until **Health: Ok (green)** — the AWS sample page will show at the environment URL. (You'll replace it in Part 2.)

---

# Part 2 — Create the pipeline (connect GitHub → deploy to Beanstalk)

1. Open **CodePipeline** (same region) → **Create pipeline**.
2. **Step 1: Choose creation option** → **Build custom pipeline** → **Next**.
3. **Step 2: Choose pipeline settings:**
   - **Pipeline name:** `nrw-wildfire-radar-pipeline`
   - **Pipeline type:** **V2**
   - **Service role:** **New service role** (let CodePipeline create it)
   - Leave **Advanced settings** at defaults (Default artifact store, Default AWS Managed Key) → **Next**
4. **Step 3: Add source stage:**
   - **Source provider:** **GitHub (via GitHub App)**
   - **Connection:** choose **Connect to GitHub** →
     1. On **Connect to GitHub**, a **Connection name** is filled in → **Connect to GitHub**.
     2. Choose **Authorize AWS Connector for GitHub**.
     3. Under **GitHub Apps**, choose **Install a new app** → pick the **Sudharsan2618** account → on **Install AWS Connector for GitHub**, select **Only select repositories → NRW-Risk-Radar** (or all repos) → **Install**.
     4. Back on **Connect to GitHub**, choose **Connect**.
   - **Repository name:** `Sudharsan2618/NRW-Risk-Radar`
   - **Default branch:** `main`
   - **Output artifact format:** **CodePipeline default**
   - → **Next**
5. **Step 4: Add build stage:** choose **Skip build stage** → confirm **Skip**. *(No build needed — pure standard library.)*
6. **Step 5: Add test stage** (if shown): **Skip test stage** → confirm.
7. **Step 6: Add deploy stage:**
   - **Deploy provider:** **AWS Elastic Beanstalk**
   - **Region:** Europe (Frankfurt) eu-central-1
   - **Application name:** `nrw-wildfire-radar`
   - **Environment name:** the environment from Part 1 (e.g. `nrw-wildfire-radar-env`)
   - → **Next**
8. **Step 7: Review** → **Create pipeline**.

The pipeline runs immediately: it pulls `main`, hands the repo to Elastic
Beanstalk, and Beanstalk deploys your real app (replacing the sample). When both
stages show **Succeeded**, open the environment URL → **mock login → radar**.

---

# Part 3 — How updates work (the whole point)

From now on you just push:

- Work on your `Dev` branch, then merge/publish to `main` (or push straight to `main`).
- CodePipeline detects the push (via the GitHub App), and redeploys automatically.
- Watch progress in the **CodePipeline** console; watch the app roll over in the **Elastic Beanstalk** environment.

*(Your local working branch is `Dev`. To publish to the deploy branch you can push `Dev` to the public repo's `main`, e.g. via your Git client. The pipeline watches `main`.)*

---

## Troubleshooting
- **Deploy stage fails / environment red after deploy:** check **PORT=8000** is set in the environment properties (Part 1, step 12). The Python reverse proxy forwards to 8000.
- **Source stage can't see the repo:** the AWS Connector GitHub App wasn't granted access to `NRW-Risk-Radar`. Fix under **Developer Tools → Settings → Connections**, or reinstall the app with the repo selected.
- **App shows "Sample data" for a source:** that source's env property is missing/incorrect.
- **Logs:** Elastic Beanstalk environment → **Logs → Request logs (Last 100 lines)**.
- **First live boot** takes ~10–30s while it fetches the feeds — normal.

## Cost & teardown
- Single-instance `t3.small` ≈ **$15/mo**; CodePipeline V2 bills per active pipeline/action (a few $/mo for light use); the GitHub connection is free.
- To stop charges: **terminate the Beanstalk environment** (Actions → Terminate environment) and **delete the pipeline**.
