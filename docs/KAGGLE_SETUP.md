# Kaggle setup for retraining

One-time setup so the admin **Retrain** button can train a model on Kaggle's free GPU. For the overall flow see [MODEL_LIFECYCLE.md](./MODEL_LIFECYCLE.md).

## 1. Credentials for the admin app

Create an API token in your Kaggle account settings and put it in `apps/admin/.env.local`:

```text
KAGGLE_USERNAME="your_username"
KAGGLE_KEY="KGAT_..."
KAGGLE_KERNEL_SLUG="your_username/snappick-ml"
```

`KAGGLE_KERNEL_TITLE` is optional. The title must turn into the slug's name (for `snappick-ml` the default title is "Snappick ML"); otherwise Kaggle creates a different notebook.

## 2. Create the notebook (first Retrain click)

Restart `npm run dev` after editing `.env.local`, sign in to the admin dashboard, open **Dataset** and press **Retrain**. The admin app pushes `ml/notebooks/kaggle_waste_detector_retraining.ipynb` to your account as the fixed notebook above, with GPU and internet enabled and the base dataset `sumn2u/garbage-classification-v2-bbox-384` attached.

The first run stops at Step 2 with "Supabase secrets are missing". That is expected: secrets belong to a notebook, and a new notebook has none yet.

## 3. Attach the Supabase secrets (once)

1. Open `https://www.kaggle.com/code/<your_username>/snappick-ml`.
2. Choose **Add-ons → Secrets** and add:
   - `SUPABASE_URL` - your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - your service-role key
3. Attach both to this notebook.

The service-role key is a powerful secret. It is used only by this notebook; it must never go into the mobile app, the admin app or git.

## 4. Run

Press **Retrain** again. Each click adds a new version to the same notebook, so the secrets stay attached. The admin dialog shows the timer and state. When the run finishes, the new version appears on the **Models** page as a candidate (not live).

## Troubleshooting

| Message | Cause and fix |
|---|---|
| "Kaggle did not start the run: … title … already in use" | A different notebook already has that title. Use the title that matches your slug, or set `KAGGLE_KERNEL_TITLE`. |
| Run fails quickly, log says "Supabase secrets are missing" | Attach the two secrets to the notebook (step 3). |
| "Kaggle is not configured" | `KAGGLE_USERNAME` or `KAGGLE_KEY` is missing in `apps/admin/.env.local`. |
| The dialog shows "failed" but the notebook is still running | The dialog gives up after 2 hours. Check the notebook on Kaggle. |
| No new model appears | Open the notebook's log on Kaggle and read the last error. Step 8 registers the model. |
