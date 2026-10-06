# SNAPPICK_PREREQUISITE

Everything you must check or set up **manually** before Phase 1. Allow about half a day, plus waiting time for account verification. Commands are for **Windows PowerShell**. Tick each box. Parts G to L are needed at different phases, so each says when.

Design is in `SNAPPICK_PLAN.md`; phases are in `SNAPPICK_BUILD_GUIDE.md`.

| Part | What | Needed by |
|---|---|---|
| A | Machine | Phase 1 |
| B | Tools | Phase 1 |
| C | Phone | Phase 1 |
| D | Accounts overview | Phase 1 |
| E | Repository | Phase 1 |
| F | Environment record | Phase 1 |
| G | Supabase project | Phase 1 |
| H | Google Cloud | Phase 3 |
| I | OpenAI | Phase 6 (optional) |
| J | Firebase | Phase 9 |
| K | ML tools | Phase 4 |
| L | GitHub secrets and Vercel | Phases 11 and 13 |
| M | Data collection protocol | Start now |
| N | Spike archive | Phase 1 |
| O | Final readiness checklist | Before Phase 1 |

**Not needed:** Docker (you use a hosted Supabase project), an Apple developer account (Android only), a Google Maps API key or billing (the map uses MapLibre), an Expo account or EAS (you build locally).

---

## Part A. Machine

- [ ] Windows 10 or 11, 64-bit.
- [ ] RAM: 16 GB recommended (Android Studio, the emulator, and Metro together are heavy). 8 GB works but is slow.
- [ ] Free disk: at least 40 GB (Android SDK, Gradle caches, datasets, model files).
- [ ] **Short repository path.** Use `C:\Projects\snappick`. Android native builds can fail on long paths.
- [ ] Enable long paths (PowerShell **as Administrator**, once):
  ```powershell
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  git config --system core.longpaths true
  ```
  Restart the PC afterwards.

---

## Part B. Tools

Install with `winget` or the vendors' installers. Close and reopen PowerShell after installing so the PATH updates.

- [ ] **Git:** `winget install Git.Git`
- [ ] **Node.js (LTS):** `winget install OpenJS.NodeJS.LTS`
  - **Manual check:** open the Expo SDK reference (https://docs.expo.dev/versions/latest/), confirm the page is for SDK 57, and read the table row for the **minimum Node.js version**. Your installed Node must meet it. (Other tools used in the project have also asked for Node 22 or later, so prefer the current LTS.) Write it down in Part F.
- [ ] **JDK 17:** `winget install Microsoft.OpenJDK.17`
- [ ] **Android Studio:** download from https://developer.android.com/studio and run the first-time wizard.
  - In **SDK Manager → SDK Platforms:** install the platform matching the `compileSdkVersion` in the Expo SDK reference's Android table for SDK 57. (Other projects built on recent Expo SDKs report API level 36; **confirm against the Expo table**, do not assume.)
  - In **SDK Manager → SDK Tools:** install *Android SDK Build-Tools*, *Android SDK Platform-Tools*, *Android SDK Command-line Tools (latest)*, *CMake*, and *NDK (Side by side)*. The TFLite library compiles native code, so installing CMake and the NDK now avoids surprise downloads mid-build.
- [ ] **Environment variables** (PowerShell, once, then reopen it):
  ```powershell
  [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
  $p = [Environment]::GetEnvironmentVariable("Path","User")
  [Environment]::SetEnvironmentVariable("Path", "$p;$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")
  ```
- [ ] **SDK licences.** If you install SDK components with Google's newer **Android CLI** (`android sdk install ...`), it manages the licences and saves them in a format Gradle accepts, so no separate step is needed. If you use Android Studio's SDK Manager instead, accepting the licence prompts there is enough. Only if a build later reports unaccepted licences, run `sdkmanager --licenses` from `cmdline-tools\latest\bin` (the older tool still exists) and answer `y`.
- [ ] **Python (Miniconda):** `winget install Anaconda.Miniconda3`, then two **separate** environments:
  ```powershell
  conda create -n snappick python=3.11 -y
  conda create -n snappick-label python=3.11 -y
  ```
  `snappick` is for the ML pipeline; `snappick-label` is only for Label Studio (kept apart to avoid dependency clashes).
- [ ] **Code editor** (VS Code or similar) and an AI coding assistant that can read your repository.

---

## Part C. Phone

- [ ] Android phone you will test on (the spike ran on it). Android 8 or later is the practical minimum; newer is better.
- [ ] Enable **Developer options** (Settings → About phone → tap *Build number* seven times), then enable **USB debugging**.
- [ ] Use a **data-capable USB cable** (some cables only charge).
- [ ] Plug in, accept the "Allow USB debugging" prompt, and run `adb devices`. Expected: your device listed as `device` (not `unauthorized` or `offline`).
- [ ] **Google Maps** (or another maps app) installed, so the Navigate button has something to open.
- [ ] Camera works, and the phone has at least 2 GB free storage.
- [ ] **A second test device** for the marketplace phases (Phase 8): a second phone, or an Android emulator from Android Studio's Device Manager.

---

## Part D. Accounts overview

Create these now so verification delays don't block you later.

| Account | Cost and card | Used in |
|---|---|---|
| GitHub | Free | Repo, Actions (Phase 11) |
| Supabase | Free tier, no card. Free projects can **pause after inactivity**. | All phases |
| Google Cloud | Free for OAuth sign-in. **If it asks for a card or billing, stop and check before continuing.** | Phase 3 |
| Kaggle | Free; **phone verification** needed for GPU | Phases 4, 11, 15 |
| OpenAI | Needs a payment method and prepaid credit | Phase 6 (optional, see Part I) |
| Firebase | Free (Spark plan) | Phase 9 |
| Vercel | Free Hobby tier (check its terms for your use) | Phase 13 |

- [ ] GitHub, Supabase, Kaggle (with phone verified), Google, and Firebase accounts created. OpenAI and Vercel can wait.

---

## Part E. Repository

- [ ] Create the repo (PowerShell):
  ```powershell
  mkdir C:\Projects\snappick
  cd C:\Projects\snappick
  git init -b main
  git config user.name "Your Name"
  git config user.email "you@example.com"
  mkdir apps, supabase, ml, scripts, docs
  ```
- [ ] Copy the files from this package into place:
  - `AGENTS.md` → repo root
  - `SNAPPICK_PLAN.md`, `SNAPPICK_BUILD_GUIDE.md`, `SNAPPICK_PREREQUISITE.md` → `docs\`
- [ ] Create a root `.gitignore` containing at least:
  ```
  node_modules/
  .env
  .env.*
  !.env.example
  ml/data/
  apps/mobile/android/
  apps/mobile/ios/
  *.jks
  *.keystore
  google-services.json
  __pycache__/
  .venv/
  ```
  (Phase 1 refines it.)
- [ ] First commit: `git add . ; git commit -m "docs: initial plan, guide, prerequisite"`
- [ ] Create a **private** GitHub repository, then:
  ```powershell
  git remote add origin https://github.com/YOUR-USER/snappick.git
  git push -u origin main
  ```
- [ ] Layout decision recorded: **one repo, independent package roots** (`apps/mobile`, `apps/dashboard`, `ml`, `supabase`), no shared JavaScript workspace. Reason: the Expo app pins exact React Native and React versions, and the spike was proven as a standalone project. (Expo does support npm workspaces if you ever need code sharing.)

---

## Part F. Environment record

Run these and paste the results into `docs\ENVIRONMENT.md` (create it). The AI reads this file.

| Command | What to record |
|---|---|
| `node -v` and `npm -v` | Versions. Compare Node with the Expo SDK 57 minimum. |
| `git --version` | Version |
| `java -version` | Must be 17 or later |
| `adb version` | Installed |
| `conda --version` and `python --version` (inside `conda activate snappick`) | Versions |
| `echo $env:ANDROID_HOME` | Path (not empty) |
| Android SDK Manager | Installed platform, build-tools, CMake, NDK versions |

Also write down decisions you must not change later:

- [ ] **Android package name**, for example `com.yourname.snappick`. It is used by Google sign-in (Phase 3) and Firebase (Phase 9) and is painful to change. Choose now.
- [ ] Phone model and Android version (this is your "reference phone" for latency measurements).
- [ ] Expo SDK 57 table values: minimum Node, `compileSdkVersion`.

---

## Part G. Supabase project (needed for Phase 1)

- [ ] Sign in at https://supabase.com and create a **new project**. Choose the region nearest your users and set a strong database password. Save the password in a password manager.
- [ ] In **Project Settings → API** copy: the **Project URL**, the **anon / publishable key** (safe for the app), and the **service-role / secret key** (**never** put this in the app or git; store it only for GitHub secrets and server tools).
- [ ] Log in and link the CLI from the repo root:
  ```powershell
  cd C:\Projects\snappick
  npx supabase login
  npx supabase init
  npx supabase link --project-ref YOUR_PROJECT_REF
  ```
  The project ref is the id in your dashboard URL. No Docker is needed for `link` and `db push`.
- [ ] Note that free projects can pause after inactivity. Open the dashboard before any session or demo and confirm it is active.
- [ ] Later phases ask you to enable extensions (PostGIS in Phase 2's migration; `pg_cron` in Phase 8; `pg_net` in Phase 14). Nothing to do now.

---

## Part H. Google Cloud (before Phase 3)

Used only for Google sign-in (no Maps API, no billing).

- [ ] Create a Google Cloud project and configure the OAuth consent screen (External, Testing), adding your own Gmail as a test user.
- [ ] You will need your Android package name (Part F) and the **SHA-1 of your debug keystore** (Phase 3's checklist gives the exact command). If you ever delete and regenerate `apps/mobile/android`, re-check the SHA-1.
- [ ] If Google asks for a billing account at any point, stop and check; OAuth sign-in should not require one.

---

## Part I. OpenAI (before Phase 6, optional)

- [ ] Create an API key and set a **monthly usage limit** in the billing settings.
- [ ] Store it only as a Supabase secret (Phase 6 gives the command). Never put it in the app.
- [ ] **No card? Skip this part.** The guidance function has a templates-only mode (reviewed templates plus bundled advice). The phase still passes with the LLM checks marked skipped.

---

## Part J. Firebase (before Phase 9)

- [ ] Create a Firebase project and add an **Android app** using the exact package name from Part F.
- [ ] Download `google-services.json` (it is git-ignored) and create FCM v1 service-account credentials. Phase 9's checklist gives the exact click path and where to store them.

---

## Part K. ML tools (before Phase 4)

- [ ] **Kaggle:** account verified by phone. Open the account's settings and confirm GPU access and your weekly GPU quota. Create an API token only in Phase 11.
- [ ] **Colab** account (Google) as the manual fallback.
- [ ] **Label Studio:**
  ```powershell
  conda activate snappick-label
  pip install label-studio
  label-studio start
  ```
  Confirm it opens in the browser, then stop it.
- [ ] Free disk space for datasets (at least 20 GB beyond Part A is comfortable).
- [ ] **Licence habit:** for every dataset you consider, note its source and licence. Public mirrors can carry different licences from the original, so check each one. Phase 4 proposes datasets; you approve them.
- [ ] **Supervisor questions** (ask early, record the answers in `docs\ENVIRONMENT.md`):
  - The detector (Ultralytics YOLO) is AGPL-3.0. Is that acceptable for the project and the pilot release?
  - Is a self-collected dataset a marking requirement?

---

## Part L. GitHub secrets and Vercel (Phases 11 and 13)

- [ ] Nothing to do now. Phase 11 lists the GitHub repository secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KAGGLE_USERNAME`, `KAGGLE_KEY`). Phase 13 uses a Vercel project with root directory `apps/dashboard`.

---

## Part M. Data collection protocol (start now)

The **local golden test set** is the one dataset you cannot postpone. Every research result is measured on it. Public data trains M0; the golden set tells you whether it works on real household scenes.

**Targets**
- Start: 20 to 30 instances per trained class. Grow to at least 50 per class before Phase 15.
- Classes: `plastic_bottle`, `glass_bottle`, `can`, `cardboard`, `paper`, `plastic_container`, `plastic_bag_wrapper`, `beverage_carton`.
- Also collect **30 to 50 negatives**: clutter and non-waste objects (cups of other kinds, toys, tools, furniture corners, plants) so the model can learn to stay quiet.

**How to photograph**
- [ ] Several sessions on **different days and places**. Golden-set sessions must be **different** from any photos you later use for training.
- [ ] Vary lighting (daylight, kitchen light, evening), backgrounds (kitchen floor, table, bin bags, gate area), distance, and angle. Include single items and mixed piles. Hold the phone at normal height.
- [ ] Keep the **original phone resolution**. Do not edit, crop, or filter.
- [ ] **Privacy:** no faces, identity documents, vehicle plates, or children in frame. Photograph only your own items or items from people who agreed.
- [ ] Store raw files in `ml\data\local\golden\raw\` (git-ignored) with names like `20261012_s01_0001.jpg`.
- [ ] Keep a `session_log.csv` with: date, place, lighting, phone, number of photos, notes.
- [ ] Do not annotate yet. Annotation starts in Phase 4.

---

## Part N. Spike archive (before Phase 1)

- [ ] Copy the spike's main screen file (the `App.tsx` content from your spike project, which lives in `src\app\index.tsx` there) into `scripts\spike\App.tsx` in the new repo.
- [ ] Create `docs\SPIKE_RESULTS.md` containing:
  - the results table (preprocess about 1.5 s, inference about 350 ms, decode about 110 ms, multi-object boxes, map pins and Navigate passed);
  - the output of `npm ls react-native-fast-tflite react-native-nitro-modules @maplibre/maplibre-react-native expo react-native` run inside the spike project;
  - the **export details**: the exact Ultralytics export command, the output of `pip show ultralytics`, and the tensor shapes the app printed (`[1,3,640,640]` in, `[1,84,8400]` out);
  - whether the map showed real tiles with the OpenFreeMap style, or a blank map (a screenshot helps);
  - the phone model.
- [ ] Optional: copy the spike's `.tflite` file to a safe place outside git. It is the placeholder model for Phase 5.

---

## Part O. Final readiness checklist

- [ ] `node -v`, `java -version`, `adb devices`, and `git --version` all work, and `adb devices` shows `device`.
- [ ] Android SDK platform, build-tools, CMake, and NDK installed; licences accepted.
- [ ] Repo at `C:\Projects\snappick`, first commit pushed to a private GitHub repo.
- [ ] `AGENTS.md` at the root and the three docs in `docs\`.
- [ ] `docs\ENVIRONMENT.md` filled in, including the Android package name.
- [ ] Supabase project created, keys saved, CLI linked, dashboard shows it active.
- [ ] Kaggle phone-verified; Label Studio starts.
- [ ] Spike archived with results and export details.
- [ ] First golden-set photo session done (even a small one).
- [ ] Supervisor questions asked (AGPL, dataset requirement).

When every box is ticked, start Phase 1 using the wrapper prompt in the build guide.