# SnapPick Development Guide

**Last Updated:** 2026-10-30

Complete guide for setting up, running, testing, and contributing to SnapPick.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Running the Mobile App](#running-the-mobile-app)
4. [Running Tests](#running-tests)
5. [Working with the Database](#working-with-the-database)
6. [ML Model Development](#ml-model-development)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 24.20.0+ | [nodejs.org](https://nodejs.org) |
| **Git** | 2.56+ | [git-scm.com](https://git-scm.com) |
| **JDK** | OpenJDK 21 (LTS) | [adoptium.net](https://adoptium.net) |
| **Android Studio** | Ladybug/Koala | [developer.android.com](https://developer.android.com/studio) |
| **Python** | 3.11+ (for ML) | [python.org](https://python.org) or Miniconda |

### Android SDK Setup

1. **Install Android Studio** and open SDK Manager
2. **Install required components:**
   - SDK Platform: Android 17 (API 37)
   - SDK Build-Tools: 37.0.0
   - NDK (Side by side): 30.0.16248370
   - Command-line Tools: 23.0
   - CMake: 4.1.2

3. **Set environment variables:**
   ```bash
   # Windows (PowerShell)
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools"
   
   # macOS/Linux
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

4. **Verify installation:**
   ```bash
   adb --version  # Should show 1.0.41 or higher
   ```

### Android Test Device

- **Physical device recommended** (Redmi Note 10 or similar)
- **Enable Developer Options:**
  1. Settings → About Phone → Tap "Build Number" 7 times
  2. Settings → Developer Options → Enable "USB Debugging"
  3. Connect via USB and accept debugging prompt

---

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/snappick.git
cd snappick
```

### 2. Setup Supabase

**Option A: Use Remote Supabase (Recommended for Development)**

1. Create account at [supabase.com](https://supabase.com)
2. Create new project in `ap-southeast-1` (Singapore) region
3. Copy project URL and anon key from Settings → API

**Option B: Run Local Supabase**

```bash
# Install Supabase CLI
npm install -g supabase

# Start local instance
supabase start

# Apply migrations
supabase db push
```

### 3. Configure Environment Variables

```bash
# Copy example env file
cd apps/mobile
cp .env.example .env
```

Edit `apps/mobile/.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

### 4. Setup Google OAuth (Optional)

See [Google OAuth Setup Guide](./archive/GOOGLE_OAUTH_SETUP.md) for detailed steps.

### 5. Setup Firebase (For Push Notifications - Optional)

See [Firebase Setup Guide](./archive/FIREBASE_SETUP.md) for detailed steps.

---

## Running the Mobile App

### Development Mode (Expo Go - Limited Features)

```bash
cd apps/mobile
npm install
npx expo start
```

**Limitations:** Expo Go doesn't support:
- `react-native-fast-tflite` (ML inference)
- `@maplibre/maplibre-react-native` (maps)
- Google OAuth

### Development Build (Full Features)

```bash
cd apps/mobile
npm install

# Android
npx expo run:android

# The app will automatically open on connected device
```

**First build takes 10-15 minutes.** Subsequent builds are faster.

### Hot Reload During Development

After initial development build:
```bash
npx expo start --dev-client
```

Press `a` to reload on Android device. Code changes hot-reload automatically.

---

## Running Tests

### Mobile App Unit Tests (63 tests)

```bash
cd apps/mobile
npm test

# Watch mode (re-run on file changes)
npm test -- --watch

# With coverage report
npm test -- --coverage
```

**Test coverage includes:**
- Detector preprocessing (centre crop, letterbox)
- NMS postprocessing
- Recycling rules engine
- Pickup form validation
- Grid snapping (privacy)
- Prompt templates (SnapBot)

### ML Contract Tests (10 tests)

```bash
# Setup Python environment (first time only)
conda create -n snappick python=3.11
conda activate snappick
pip install -r ml/requirements-phase4.txt

# Run tests
python -m unittest discover -s ml/tests
python -m unittest discover -s scripts
```

### Supabase Integration Tests (48 tests)

```bash
cd supabase/tests
npm install

# Run all test suites
npm run test:rls           # Row-level security
npm run test:pickup        # Pickup creation & cancellation
npm run test:marketplace   # Claim & concurrency
npm run test:expiry        # Auto-release expired claims
npm run test:completion    # Proof upload & confirmation
npm run test:feedback      # Active learning gating
```

**Prerequisites:**
- Local Supabase running (`supabase start`)
- Migrations applied (`supabase db push`)

---

## Working with the Database

### Apply Migrations

```bash
cd supabase

# Remote (production)
supabase db push

# Local
supabase db reset  # Resets and applies all migrations
```

### Create New Migration

```bash
supabase migration new your_migration_name

# Edit the generated file in supabase/migrations/
# Then apply with: supabase db push
```

### Database Shell (psql)

```bash
# Local
supabase db shell

# Remote
supabase db shell --db-url $DATABASE_URL
```

### Inspect Database

```bash
# List tables
\dt

# Describe table
\d profiles

# View RLS policies
\d+ profiles
```

### Seed Test Data

```bash
# Run seed.sql (creates test users, districts, rule sets)
supabase db execute < supabase/seed.sql
```

---

## ML Model Development

### Inspect Current Model

```bash
cd ml
python -m src.inspect_tflite ../apps/mobile/assets/models/snappick_det_v0.tflite
```

**Output:**
- Input tensor: `[1, 3, 384, 384]` (NCHW, float32)
- Output tensor: `[1, 11, 3024]` (Raw YOLO)
- Model size: 12.7 MB

### Validate Model Contract

```bash
python -m src.contract --model ../apps/mobile/assets/models/snappick_det_v0.tflite \
                       --manifest ../apps/mobile/assets/models/model_manifest.json
```

**Checks:**
- Input shape matches manifest
- Output shape matches manifest
- Label count matches manifest
- Tensor dtypes correct

### Test Model Inference

```bash
python -m src.smoke_test --model ../apps/mobile/assets/models/snappick_det_v0.tflite \
                         --image test_images/sample.jpg
```

### Retrain Model

See [MODEL_IMPROVEMENT_GUIDE.md](./MODEL_IMPROVEMENT_GUIDE.md) for full retraining pipeline.

**Quick summary:**
1. Export feedback samples from database
2. Label with Label Studio
3. Train YOLOv8n on Kaggle GPU
4. Export to TFLite with `yolo export format=tflite`
5. Validate contract
6. Replace bundled model in `apps/mobile/assets/models/`

---

## Common Tasks

### Reset Development Environment

```bash
# Clear Metro cache
cd apps/mobile
npx expo start -c

# Clear Android build cache
cd android
./gradlew clean
cd ..

# Rebuild app
npx expo run:android
```

### Update Dependencies

```bash
# Mobile app
cd apps/mobile
npx expo install --fix  # Auto-fixes incompatible versions
npm outdated            # Check for updates

# Never manually update Expo SDK packages!
# Always use: npx expo install <package>
```

### View Logs

```bash
# Android device logs
adb logcat | grep SnapPick

# Metro bundler logs (JavaScript)
npx expo start  # Logs appear in terminal

# Supabase Edge Function logs
supabase functions logs snapbot-chat --tail
```

### Deploy Edge Functions

```bash
cd supabase/functions

# Deploy single function
supabase functions deploy snapbot-chat

# Deploy all functions
supabase functions deploy
```

### Generate APK for Testing

```bash
cd apps/mobile

# Development APK
npx expo run:android --variant release

# Production APK (requires signing keystore)
eas build --platform android --profile production
```

---

## Troubleshooting

### "Metro bundler failed to start"

**Solution:**
```bash
npx expo start -c  # Clear cache
```

### "TFLite model not found"

**Check:**
1. Model file exists: `apps/mobile/assets/models/snappick_det_v0.tflite`
2. `metro.config.js` includes `tflite` in `resolver.assetExts`
3. Rebuild app: `npx expo run:android`

### "Map not rendering"

**Causes:**
- MapLibre requires **development build** (not Expo Go)
- Check map style URL in `.env`
- Verify device has internet connection

**Debug:**
```bash
# Check if map tiles load
curl https://tiles.openfreemap.org/styles/liberty/style.json
```

### "Supabase connection failed"

**Check:**
1. `.env` file has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
2. Restart Metro: `npx expo start -c`
3. Test connection:
   ```bash
   curl -H "apikey: $ANON_KEY" "$SUPABASE_URL/rest/v1/"
   ```

### "Android build failed: path too long" (Windows)

**Solution:**
```bash
# Enable long paths (Admin PowerShell)
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1

# Git long paths
git config --system core.longpaths true

# Keep repository path short: C:\Projects\snappick
```

### "Google OAuth not working"

**Check:**
1. SHA-1 fingerprint registered in Firebase Console
2. `google-services.json` in `apps/mobile/android/app/`
3. Package name matches: `com.snappick.mobile`

**Get SHA-1:**
```bash
cd apps/mobile/android
./gradlew signingReport
```

### "Module not found: @supabase/supabase-js"

**Solution:**
```bash
cd apps/mobile
rm -rf node_modules package-lock.json
npm install
npx expo start -c
```

### "Tests failing: Cannot find module"

**Solution:**
```bash
# Mobile tests
cd apps/mobile
npm install

# ML tests
conda activate snappick
pip install -r ml/requirements-phase4.txt

# Supabase tests
cd supabase/tests
npm install
```

---

## Development Workflow

### Feature Development

1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** and test locally

3. **Run tests:**
   ```bash
   cd apps/mobile
   npm test
   npm run typecheck
   ```

4. **Commit with conventional commits:**
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue"
   git commit -m "docs: update guide"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```

### Database Changes

1. **Create migration:**
   ```bash
   cd supabase
   supabase migration new add_feature
   ```

2. **Write SQL** in generated file

3. **Test locally:**
   ```bash
   supabase db reset  # Applies all migrations fresh
   ```

4. **Write integration tests:**
   ```bash
   cd supabase/tests
   # Add test cases
   npm run test:<suite>
   ```

5. **Deploy to remote:**
   ```bash
   supabase db push
   ```

---

## Additional Resources

- **Architecture Overview:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Dataset Collection:** [DATASET_COLLECTION_GUIDE.md](./DATASET_COLLECTION_GUIDE.md)
- **Model Retraining:** [MODEL_IMPROVEMENT_GUIDE.md](./MODEL_IMPROVEMENT_GUIDE.md)
- **Development Rules:** [../AGENTS.md](../AGENTS.md)
- **Environment Details:** [ENVIRONMENT.md](./ENVIRONMENT.md)

---

## Getting Help

1. **Check documentation** in `docs/` folder
2. **Search GitHub issues**
3. **Ask in team chat**
4. **Check Expo docs:** [docs.expo.dev](https://docs.expo.dev)
5. **Check Supabase docs:** [supabase.com/docs](https://supabase.com/docs)
