# M0 reproduction notebook notes

The source notebook is preserved outside Git at `ml/artifacts/m0/waste_detection_training.ipynb`.
It downloads `sumn2u/garbage-classification-v2-bbox-384`, normalizes records to YOLO boxes,
shuffles with seed 42, trains `yolov8n.pt` for 50 epochs at `imgsz=384`, batch 16 and patience
10, then exports float32 TFLite. The notebook hard-codes the owner-verified label order:

`metal, trash, glass, paper, cardboard, plastic, biological`

Before a reproducible rerun, record the Kaggle dataset immutable version/licence, the installed
Ultralytics/TensorFlow versions, the checkpoint hash, the held-out metrics, ten reference images,
and the PyTorch/TFLite parity result. Do not use the local golden set for training or tuning.
