# SnapPick: Complete UI/UX Interface Specification & Figma Design Blueprint

> **Document Version:** 1.0.0  
> **Target Platform:** Android (Native via Expo & React Native)  
> **Figma Canvas Dimensions:** Android Large (360 × 800 dp) / Standard Mobile (390 × 844 dp)  
> **Status:** Production Design Reference for UI/UX Prototyping  

---

## 1. Executive Summary & Design System Foundations

SnapPick is an AI-powered waste classification and community collection platform focused on Malaysian Separation at Source (SAS) regulations. The app operates under a **unilateral user model**: every authenticated resident can both request recyclable pickups and claim nearby collection tasks.

### 1.1 Color Palette & Semantic Tokens

| Token Name | Hex Code | Semantic Role | Usage Context |
|---|---|---|---|
| `primary-green` | `#16A34A` | Main Brand / Eco Active | Primary CTAs, active tab icons, verified recyclable badges |
| `primary-green-dark` | `#15803D` | Active / Pressed | Button press states, focused border highlights |
| `primary-green-subtle` | `#DCFCE7` | Surface Tint | Background for success pills, accepted category tags |
| `warning-amber` | `#D97706` | Conditional / Action Required | "Clean & dry" preparation needed, pending claim status |
| `warning-amber-subtle` | `#FEF3C7` | Warning Surface | SAS guidance alert cards, uncertain detection banners |
| `danger-rose` | `#DC2626` | Destructive / Ineligible | General waste (non-recyclable), dispute status, cancel CTAs |
| `danger-rose-subtle` | `#FEE2E2` | Danger Surface | Hazardous item alerts, out-of-service geofence error banners |
| `uncertain-grey` | `#64748B` | Low Confidence / Neutral | Detection confidence < threshold, disabled buttons, borders |
| `surface-bg` | `#F8FAFC` | App Background | Screen background canvas |
| `surface-card` | `#FFFFFF` | Card Container | Bottom sheets, floating cards, list row items |
| `text-primary` | `#0F172A` | Primary Typography | Headers, card titles, key metric numbers |
| `text-muted` | `#64748B` | Secondary Typography | Subtitles, input placeholders, timestamp captions |

### 1.2 Bounding Box Color Mapping (YOLO Object Detection)

| Classification Outcome | Bounding Box Border | Label Badge Fill | Meaning in SnapPick |
|---|---|---|---|
| **Accepted Recyclable** | `2px solid #16A34A` | `#16A34A` (White text) | Item is cleanly recyclable (plastic, cardboard, paper, metal, glass). |
| **Conditional Recyclable** | `2px solid #D97706` | `#D97706` (White text) | Recyclable only if user confirms clean/dry state. |
| **General Waste / Prohibited** | `2px solid #DC2626` | `#DC2626` (White text) | Biological/trash or non-eligible item. Excluded from pickup. |
| **Uncertain Detection** | `2px dashed #94A3B8` | `#475569` (White text) | Detector confidence is low or borderline. User review required. |

### 1.3 Fixed Class Taxonomy (Model Contract)
The detector strictly outputs 7 plain-text classes in fixed order:
1. `metal` (Conditional)
2. `trash` (Prohibited)
3. `glass` (Conditional)
4. `paper` (Conditional)
5. `cardboard` (Conditional)
6. `plastic` (Conditional)
7. `biological` (Prohibited)

*Hazardous materials (batteries, light bulbs, e-waste, chemicals, sharps) are never detected by AI; they are managed through mandatory manual safety declaration checklists.*

---

## 2. Information Architecture & Navigation Tree

```mermaid
flowchart TD
    AppInit([App Launch]) --> AuthCheck{Session Valid?}
    
    %% Auth Branch
    AuthCheck -- No --> SignIn[03. Sign In Screen]
    SignIn <--> SignUp[04. Sign Up Screen]
    SignIn --> ForgotPass[05. Password Reset Sheet]
    
    %% First Run Consent Branch
    SignIn --> ConsentCheck{Consents Complete?}
    SignUp --> SafetyAck[06. Safety Acknowledgement Screen]
    SafetyAck --> ImageConsent[07. Image Consent & ML Opt-In]
    ConsentCheck -- No --> SafetyAck
    ImageConsent --> TabRoot
    
    %% Main Tab Navigation
    AuthCheck -- Yes --> TabRoot[Tab Navigation Bar]
    
    subgraph Tabs [Bottom Navigation (5 Tabs)]
        TabRoot --> Tab1[08. Home Dashboard]
        TabRoot --> Tab2[18. Activity & Tracking]
        TabRoot --> Tab3[10. Scan Viewfinder]
        TabRoot --> Tab4[15. Request Marketplace Map]
        TabRoot --> Tab5[22. Profile & Settings]
    end
    
    %% Tab 1 Sub-flows
    Tab1 --> SnapBot[09. SnapBot AI Chat Modal]
    
    %% Tab 3 Sub-flows (Scan)
    Tab3 --> Processing[11. Scan Processing Overlay]
    Processing --> ScanVisualizer[12. Scan Results Visualizer]
    ScanVisualizer <--> ReviewSheet[13. Review Items Bottom Sheet]
    ReviewSheet --> CreatePickup[14. Create Pickup Request Flow]
    
    %% Tab 4 Sub-flows (Marketplace)
    Tab4 <--> MarketList[16. Marketplace List View]
    Tab4 --> PinPreview[17. Marketplace Pin Preview Drawer]
    PinPreview --> ClaimPickup[Claim Job Action]
    
    %% Fulfillment Sub-flows
    ClaimPickup --> ClaimedDetail[19. Claimed Pickup Fulfillment Screen]
    Tab2 --> ClaimedDetail
    Tab2 --> RequesterVerify[20. Requester Proof Verification Screen]
    RequesterVerify --> DisputeModal[21. Dispute & Report Modal]
```

---

## 3. Comprehensive Interface Specifications

---

### [Screen 01] Splash & Launch Screen
* **Route:** `/index` (Root Redirector)
* **Type:** Fullscreen Splash State
* **Purpose:** Initial cold-start brand identity, environment verification, session token hydration, and offline cache initialization.

#### UI Blueprint
```
+---------------------------------------+
|                                       |
|                                       |
|               [Logo Icon]             |
|                SnapPick               |
|     AI Waste Classification & SAS     |
|                                       |
|                                       |
|           [Spinner / Progress]        |
|          Checking connection...       |
|                                       |
|                                       |
|          Perak Circular Economy       |
+---------------------------------------+
```

#### Elements & Components
* **App Icon:** Stylized green leaf integrated with camera shutter icon (64×64 dp).
* **Wordmark:** "SnapPick" in bold sans-serif (Inter/SF Pro, 28sp, `#0F172A`).
* **Subheading:** "Smart Recycling & Community Collection" (14sp, `#64748B`).
* **Loading Indicator:** Subtle circular spinner (`#16A34A`).
* **Footer Caption:** "Supported across Perak Municipal Districts" (12sp, `#94A3B8`).

#### States & Interactions
* **Session Exists & Consents Given:** Direct smooth transition to `(tabs)/index`.
* **Session Exists & Consents Incomplete:** Redirects to `(consent)/safety`.
* **No Session:** Redirects to `(auth)/sign-in`.
* **Offline Mode:** If cached session exists, allows entry to offline scan and home with offline banner.

---

### [Screen 02] Onboarding Carousel (First-Time User)
* **Route:** `(auth)/onboarding`
* **Type:** Interactive 3-Step Swipe Carousel
* **Purpose:** Educates residents on SnapPick's unique model: camera scanning, Malaysian SAS preparation, and community collection.

#### UI Blueprint
```
+---------------------------------------+
|  [Skip]                               |
|                                       |
|          [Illustration Slide]         |
|                                       |
|        Point, Scan, & Classify        |
|   Our on-device YOLO AI identifies    |
|   plastics, paper, metal, and glass   |
|   in milliseconds—even fully offline. |
|                                       |
|              ( * o o )                |
|                                       |
|  [  Get Started  / Next  ->  ]        |
+---------------------------------------+
```

#### Elements & Components
* **Slide 1:** "AI-Powered Scanning" (Illustration of phone highlighting recyclable items with green boxes).
* **Slide 2:** "Separation at Source (SAS)" (Illustration of official Malaysian blue/brown/orange bins + clean & dry preparation).
* **Slide 3:** "Community Pickups" (Illustration of neighborhood collector picking up prepared recyclables).
* **Page Indicator Dots:** 3 dots, active dot expanded pill `#16A34A`, inactive dots `#CBD5E1`.
* **Action Buttons:** Top-right "Skip" text button; Bottom full-width "Next" / "Get Started" button.

---

### [Screen 03] Sign In Screen
* **Route:** `(auth)/sign-in`
* **Type:** Standard Form Screen (Scrollable Keyboard-Aware)
* **Purpose:** Authenticates existing users via email/password or Google Single Sign-On.

#### UI Blueprint
```
+---------------------------------------+
|  <- Back                              |
|                                       |
|  Welcome Back 👋                      |
|  Sign in to continue recycling        |
|                                       |
|  Email Address                        |
|  [ user@example.com                 ] |
|                                       |
|  Password                             |
|  [ ••••••••••••••••             (eye) ] |
|                                       |
|                 [Forgot Password?]    |
|                                       |
|  [        Sign In Button        ]     |
|                                       |
|  ------------ OR ------------         |
|                                       |
|  [ (G) Continue with Google     ]     |
|                                       |
|  Don't have an account? Sign Up       |
+---------------------------------------+
```

#### Elements & Components
* **Header:** "Welcome Back 👋" (24sp Bold), Subtitle: "Sign in to manage your scans and pickups" (14sp).
* **Email Input Field:** Left envelope icon, clear button, type `email-address`.
* **Password Input Field:** Left lock icon, right password visibility toggle (eye icon).
* **Forgot Password Link:** Right-aligned inline link (14sp Medium, `#16A34A`).
* **Sign In CTA:** High-contrast button (`#16A34A` background, white text, 48dp height).
* **Divider:** "OR" with subtle horizontal dividing lines (`#E2E8F0`).
* **Google OAuth Button:** Secondary outline button (`#FFFFFF` background, `#E2E8F0` border, Google multi-color icon).
* **Bottom Navigation Link:** "Don't have an account? **Sign Up**".

#### States & Variations
* **Validation Error:** Red outline on inputs with helper text (e.g., "Enter a valid email address").
* **Authentication Error:** Floating banner toast: "Invalid email or password credentials".
* **Loading State:** Sign In button displays centered ActivityIndicator and disables input fields.

---

### [Screen 04] Sign Up Screen
* **Route:** `(auth)/sign-up`
* **Type:** Standard Form Screen
* **Purpose:** Registers a new resident/collector account.

#### UI Blueprint
```
+---------------------------------------+
|  <- Back                              |
|                                       |
|  Create Account 🌱                    |
|  Join your local circular community   |
|                                       |
|  Full Name                            |
|  [ Ady Ha                           ] |
|                                       |
|  Email Address                        |
|  [ ady@example.com                  ] |
|                                       |
|  Password                             |
|  [ ••••••••••••••••             (eye) ] |
|  [==== Password Strength: Strong ====]|
|                                       |
|  Confirm Password                     |
|  [ ••••••••••••••••                 ] |
|                                       |
|  [ ] I agree to the Terms & Privacy   |
|                                       |
|  [        Create Account        ]     |
|                                       |
|  Already have an account? Sign In     |
+---------------------------------------+
```

#### Elements & Components
* **Inputs:** Full Name, Email, Password, Confirm Password.
* **Password Strength Meter:** 4-segment color progress bar (Weak: Red, Medium: Amber, Strong: Green).
* **Terms Checkbox:** Custom checkbox with clickable links to "Terms of Service" and "Privacy Policy".
* **Submit CTA:** "Create Account" (`#16A34A`).

---

### [Screen 05] Password Reset Sheet / Modal
* **Route:** Modal overlay from Sign In
* **Type:** Bottom Sheet (Detent: 45%)
* **Purpose:** Allows users to request a password recovery email.

#### UI Blueprint
```
+---------------------------------------+
|  ====== [Drag Handle] ======          |
|  Reset Password                       |
|  Enter your registered email and we'll|
|  send you recovery instructions.      |
|                                       |
|  Email Address                        |
|  [ user@example.com                 ] |
|                                       |
|  [    Send Recovery Link    ]         |
|  [ Cancel ]                           |
+---------------------------------------+
```

#### Elements & Components
* **Email Input:** Validates format on submit.
* **Send CTA:** Triggers Supabase password reset RPC.
* **Success View:** Transforms sheet content into checkmark illustration: "Check your inbox. Instructions sent to user@example.com."

---

### [Screen 06] Safety Acknowledgement Screen (Mandatory Onboarding)
* **Route:** `(consent)/safety`
* **Type:** Fullscreen Mandatory Step
* **Purpose:** Enforces legal and community safety policies. Collects explicit acknowledgement that hazardous materials must never be declared for community pickup.

#### UI Blueprint
```
+---------------------------------------+
|  Step 1 of 2                          |
|  Community Safety Guidelines ⚠️       |
|                                       |
|  SnapPick relies on neighbor-to-      |
|  neighbor collection. To protect      |
|  collectors, hazardous waste is       |
|  strictly PROHIBITED:                 |
|                                       |
|  +---------------------------------+  |
|  | [!] Never Include in Pickups:   |  |
|  | * Car/Household Batteries       |  |
|  | * Light Bulbs & Fluorescents    |  |
|  | * E-Waste & Circuit Boards      |  |
|  | * Chemicals & Corrosive Cans    |  |
|  | * Syringes & Sharp Medical Waste|  |
|  +---------------------------------+  |
|                                       |
|  Preparation Rules:                   |
|  (v) All recyclables must be RINSED   |
|  (v) Dry and packed in clear/tied bags|
|                                       |
|  [X] I understand and agree to        |
|      strictly exclude hazardous items.|
|                                       |
|  [      Acknowledge & Continue     ]  |
+---------------------------------------+
```

#### Elements & Components
* **Progress Pill:** "Step 1 of 2: Safety Standards".
* **Hazard Alert Box:** Danger card (`#FEE2E2` background, `#DC2626` border and icons).
* **Prohibited Items List:** Includes icon badges for Battery, Lightbulb, Microchip, Chemical Flask, and Syringe.
* **Preparation Pledge:** Checkmark points for "Rinsed & Clean" and "Securely Packed".
* **Acknowledgement Checkbox:** Mandatory switch/checkbox. Button remains disabled until checked.
* **Continue CTA:** Saves `safety_acknowledged: true` timestamp to user profile.

---

### [Screen 07] Image Storage & Continuous Learning Consent Screen
* **Route:** `(consent)/image-storage`
* **Type:** Fullscreen Consent Step
* **Purpose:** Transparent, GDPR-compliant consent flow explaining how images are processed, anonymized, and used for retraining the on-device YOLO detector.

#### UI Blueprint
```
+---------------------------------------+
|  Step 2 of 2                          |
|  Privacy & AI Learning 🛡️             |
|                                       |
|  Help SnapPick improve detection for  |
|  local Malaysian packaging.           |
|                                       |
|  +---------------------------------+  |
|  | Privacy Protections:            |  |
|  | * GPS coordinates stripped      |  |
|  | * Images compressed & blurred   |  |
|  | * Automated 90-day retention    |  |
|  | * Never sold or shared          |  |
|  +---------------------------------+  |
|                                       |
|  Store scans in cloud history         |
|  View your previous items anytime.    |
|  [ Toggle: ON                      ]  |
|                                       |
|  Help train SnapPick AI (Opt-in)      |
|  Allow anonymized scan photos to be   |
|  used in academic retraining runs.    |
|  [ Toggle: ON                      ]  |
|                                       |
|  [       Finish Setup & Enter      ]  |
+---------------------------------------+
```

#### Elements & Components
* **Privacy Assurance Card:** Outline card with shield icon detailing 4 privacy guarantees.
* **History Storage Switch:** Independent toggle for cloud scan history.
* **Continuous Learning Switch:** Independent toggle for training contribution ("Help improve SnapPick"). Defaults to OFF or optional ON.
* **Disclaimers:** "You can change or revoke this anytime in Profile -> Privacy Settings."
* **Finish CTA:** Writes consent flags to Supabase database and transitions to `(tabs)/index`.

---

### [Screen 08] Home Dashboard Screen
* **Route:** `(tabs)/index`
* **Type:** Main Hub / Root Tab
* **Purpose:** Core launcher providing recycling impact metrics, instant scan CTA, SnapBot AI access, Malaysian SAS quick tips, and recent scan logs.

#### UI Blueprint
```
+---------------------------------------+
|  SnapPick 🌿           [Perak v] [Bell|
|  Hello, Ady 👋                        |
|  Ready to sort your household waste?  |
|                                       |
|  +---------------------------------+  |
|  | [Camera Icon]                   |  |
|  | Scan Recyclables Now            |  |
|  | Instant offline AI classification| |
|  | [  Open Camera Shutter   ->  ]  |  |
|  +---------------------------------+  |
|                                       |
|  YOUR IMPACT                          |
|  +------------+ +------------+        |
|  |     24     | |     68     |        |
|  | Total Scans| | Verified kg|        |
|  +------------+ +------------+        |
|  +------------+ +------------+        |
|  |     3      | |   142 kg   |        |
|  | Active Pick| | CO2 Saved  |        |
|  +------------+ +------------+        |
|                                       |
|  +---------------------------------+  |
|  | [Bot Icon] Ask SnapBot AI       |  |
|  | "How to recycle cooking oil?"   |  |
|  | [ Chat with SnapBot -> ]        |  |
|  +---------------------------------+  |
|                                       |
|  RECENT ACTIVITY                      |
|  * Plastic Bottle x3   - Today 09:30  |
|  * Cardboard Box x2    - Yesterday    |
|  [ View all activity -> ]             |
+---------------------------------------+
| [Home] [Activity] [Scan] [Map] [Prof] |
+---------------------------------------+
```

#### Elements & Components
* **App Header:**
  * Left: Brand logo + "SnapPick".
  * Center/Right: District selector pill (e.g. `Kinta (Ipoh)`) that triggers district change or shows geofence status.
  * Right: Notification bell with unread badge counter.
* **Hero Scan Banner:** High-visibility green gradient card (`#16A34A` to `#15803D`) with bold white CTA button "Open Camera Shutter".
* **Impact Metric 2×2 Grid:**
  * Metric 1: Total Scans count.
  * Metric 2: Verified Items count.
  * Metric 3: Active Pickups count.
  * Metric 4: Estimated Carbon / Landfill diversion (kg).
* **SnapBot AI Launcher Card:** Interactive card featuring prompt pills that directly invoke the chat modal with pre-filled questions.
* **Malaysian SAS Quick Tips Carousel:** Cards illustrating the 3 national bins (Blue, Orange, Brown).
* **Recent Activity Section:** List items showing thumbnail icon, item title, timestamp, and status badge.
* **Offline Banner (Dynamic):** Appears above header if device is offline: "Offline Mode: Scanning & SAS rules active. Submitting pickups requires internet."

---

### [Screen 09] SnapBot Conversational AI Modal
* **Route:** Modal overlay from Home or Scan
* **Type:** Full-Height Bottom Sheet / Interactive Dialog
* **Purpose:** Free-form conversational assistant powered by cached LLM edge functions. Answers Malaysian waste sorting, hazard disposal, and local SAS questions.

#### UI Blueprint
```
+---------------------------------------+
|  ====== [Drag Handle] ======      [X] |
|  [Bot Avatar] SnapBot AI Assistant    |
|  Online • Malaysian SAS Certified     |
|                                       |
|  Suggestions:                         |
|  [How to recycle milk cartons?]       |
|  [Where to drop e-waste in Ipoh?]     |
|                                       |
|  (Bot): Hello! I can help you sort    |
|  packaging according to Malaysian SAS |
|  regulations. What do you have today? |
|                                       |
|  (User): Can I recycle aerosol cans?  |
|                                       |
|  (Bot): Yes, aerosol cans fall under  |
|  METAL recycling, BUT:                |
|  1. Ensure the can is 100% EMPTY.     |
|  2. Do not puncture or crush it.      |
|  3. Remove any plastic cap/nozzle.    |
|  Place in the ORANGE bin.             |
|                                       |
|  [Type a recycling question...   ][>] |
|  Daily queries: 8 / 10 remaining      |
+---------------------------------------+
```

#### Elements & Components
* **Modal Header:** SnapBot title, status indicator ("Online" or "Offline Knowledgebase Active"), Close button `[X]`.
* **Quick Prompt Pill Strip:** Horizontally scrolling chips for popular questions.
* **Message Thread:**
  * Resident Bubbles: Right-aligned `#16A34A`, white text.
  * SnapBot Bubbles: Left-aligned `#F1F5F9`, dark text, support markdown bolding, numbered lists, and hazard warning callouts.
* **Input Toolbar:** Text input field with placeholder "Ask how to sort any item...", Send arrow icon button.
* **Usage & Rate Limit Meter:** Shows remaining questions for the day (e.g. "8 / 10 queries remaining today").
* **Deterministic Cache Indicator:** Displays a small lightning bolt icon when an answer is served instantly from local `instruction_cache`.

---

### [Screen 10] Scan Viewfinder Camera Screen
* **Route:** `(tabs)/scan`
* **Type:** Fullscreen Camera Viewport
* **Purpose:** Captures waste photos for real-time on-device classification. Enforces a 384×384 centre-crop framing guide matching the YOLOv8 model input.

#### UI Blueprint
```
+---------------------------------------+
|  (Flash)            (384x384)   (Flip)|
|                                       |
|              [  Top Bar  ]            |
|                                       |
|        +---------------------+        |
|        | |                 | |        |
|        |   Centre-Crop Target|        |
|        |      Frame Square   |        |
|        |                     |        |
|        | |                 | |        |
|        +---------------------+        |
|                                       |
|       [ Point at household waste ]    |
|       "Good lighting • Flat surface"  |
|                                       |
|     (Gallery)     (( O ))     (Guide) |
+---------------------------------------+
| [Home] [Activity] [Scan] [Map] [Prof] |
+---------------------------------------+
```

#### Elements & Components
* **Live Camera View:** Hardware-accelerated viewfinder via `expo-camera` (`CameraView`).
* **Centre-Crop Reticle:** Semi-opaque darkened overlay outside a 384×384 dp square with white corner target marks.
* **Top Controls:**
  * Torch/Flash Toggle button (Off / On / Auto).
  * Aspect Ratio / Model Indicator ("384px Baseline M0").
  * Camera Flip button (Rear / Front).
* **Live Guidance Pill:** Floating badge above shutter with contextual tips: "Align items within square", "Avoid shadows".
* **Bottom Controls:**
  * Left: Gallery Picker button (opens device media gallery).
  * Center: Shutter Capture button (outer ring 72dp, inner green circle 58dp with press animation).
  * Right: Guide button (opens Malaysian SAS explanation modal).

#### States & Variations
* **Permission Denied State:** Renders a clean card with camera icon: "Camera access is needed to scan waste items" with "Enable Camera Permission" button.
* **Low Light Warning:** Automatic ambient sensor alert: "Lighting seems low. Tap flash icon for better detection."

---

### [Screen 11] Scan Processing Loading Overlay
* **Route:** Modal overlay upon shutter trigger
* **Type:** Animated Scanning State
* **Purpose:** Provides immediate visual feedback during the ~400ms – 1200ms preprocessing, TFLite inference, and rule evaluation pipeline.

#### UI Blueprint
```
+---------------------------------------+
|                                       |
|        +---------------------+        |
|        | [Frozen Image]      |        |
|        |                     |        |
|        |  ===============>   |        |
|        |  (Animated Laser)   |        |
|        |                     |        |
|        +---------------------+        |
|                                       |
|           [Spinner]                   |
|     Analyzing with YOLOv8n...         |
|                                       |
|   (v) Image Preprocessing (384px)     |
|   (>) On-Device Neural Inference      |
|   ( ) Malaysian SAS Rule Check        |
+---------------------------------------+
```

#### Elements & Components
* **Frozen Image Canvas:** Retains the exact captured photo.
* **Laser Scan Bar:** Green luminous horizontal line scanning vertically across the 384×384 frame with a subtle gradient trail.
* **Stage Progress Tracker:** Micro-steps showing real-time execution:
  1. Image Centre-Crop & Normalization
  2. TFLite Float32 Inference
  3. Non-Maximum Suppression (NMS)
  4. Separation at Source Rule Evaluation

---

### [Screen 12] Scan Results Visualizer Screen
* **Route:** Result state of `(tabs)/scan`
* **Type:** Interactive Image Canvas with Overlay Bounding Boxes
* **Purpose:** Displays the processed photo with interactive, color-coded bounding boxes for each detected item.

#### UI Blueprint
```
+---------------------------------------+
|  <- Retake              [Share/Export]|
|                                       |
|        +---------------------+        |
|        | +-----------------+ |        |
|        | | plastic (94%)   | |        |
|        | | [Green Box]     | |        |
|        | +-----------------+ |        |
|        |   +-------------+   |        |
|        |   | paper (62%) |   |        |
|        |   | [Amber Box] |   |        |
|        |   +-------------+   |        |
|        +---------------------+        |
|                                       |
|  +---------------------------------+  |
|  | ====== [Pull Up to Review] ==== |  |
|  | 2 Items Detected • 2 Eligible   |  |
|  | [ Quick Confirm: Clean & Dry ]  |  |
|  +---------------------------------+  |
+---------------------------------------+
```

#### Elements & Components
* **Top Bar:** "Retake Photo" back button, active rule-set identifier badge (`Perak SAS v1.2`).
* **Overlay Canvas:**
  * Bounding Boxes positioned via normalized coordinates `[ymin, xmin, ymax, xmax]`.
  * Class pill tags mounted on top-left of each box showing label + confidence (e.g. `plastic 94%`).
* **Interactive Linking:**
  * Tapping a bounding box highlights that box with a glowing drop-shadow and auto-scrolls the bottom sheet to that item's row.
  * Tapping an item row in the bottom sheet pulses the matching bounding box on the photo.
* **Collapsed Bottom Sheet Peeker:** Shows total counts and a one-tap bulk confirmation button.

---

### [Screen 13] Review Items Bottom Sheet (Collapsible Drawer)
* **Route:** Bottom sheet attached to Scan Visualizer
* **Type:** Multi-detent Bottom Sheet (35%, 70%, 95% expansion)
* **Purpose:** Detailed line-by-line verification of detected items. Allows editing labels, changing condition states, deleting false positives, and declaring unphotographed items.

#### UI Blueprint
```
+---------------------------------------+
|  ====== [Drag Handle] ======          |
|  Review Items (3 Detected • 2 Eligible)|
|                                       |
|  [ (v) Everything Looks Clean & Dry ] |
|                                       |
|  +---------------------------------+  |
|  | [Icon] Plastic Bottle    (94%) [X]|  |
|  | Label: [ Plastic         v ]    |  |
|  | State: (•)Clean  ( )Wet  ( )Damaged|
|  | SAS: Rinse and remove cap.      |  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | [Icon] Cardboard Box     (88%) [X]|  |
|  | Label: [ Cardboard       v ]    |  |
|  | State: (•)Clean  ( )Wet  ( )Damaged|
|  | SAS: Flatten flat for bundling. |  |
|  +---------------------------------+  |
|                                       |
|  [ + Add Item Not in Photo ]          |
|                                       |
|  +---------------------------------+  |
|  | [!] Hazardous Items Confirmation|  |
|  | [X] No batteries, bulbs, sharps |  |
|  +---------------------------------+  |
|                                       |
|  [   Request Community Pickup (2)   ] |
+---------------------------------------+
```

#### Elements & Components
* **Header:** Item count tally and eligible count tally.
* **Bulk Action:** "Everything Looks Clean & Dry" button (sets all conditional items to `clean_dry` with one tap).
* **Item Card (One per detected box):**
  * Thumbnail crop or category icon.
  * Class dropdown picker (Options: `metal`, `trash`, `glass`, `paper`, `cardboard`, `plastic`, `biological`).
  * Condition Segmented Selector:
    * `Clean & Dry` (Eligible - Green)
    * `Contaminated / Wet` (Ineligible - Red)
    * `Broken / Unsafe` (Ineligible - Red)
    * `Unknown` (Amber)
  * SAS Preparation Instruction: Contextual tip (e.g., "Empty liquid, rinse clean, squash flat").
  * Delete Button: Trash icon `[X]` to delete detection (captured as negative feedback).
* **Add Item Manually Button:** "Add Item Not in Photo" opens a mini-dialog to declare items without camera boxes.
* **Hazardous Materials Affirmation Checkbox:** Mandatory confirmation before submission.
* **Sticky Bottom CTA:** "Request Community Pickup (N eligible items)" (Disabled if eligible count is 0).

---

### [Screen 14] Create Pickup Request Flow
* **Route:** Sub-flow triggered from Review Items Sheet
* **Type:** Step-by-Step Form Screen / Scrollable View
* **Purpose:** Captures pickup address, landmarks, access notes, pickup schedule, and validates the location against the Perak municipal geofence.

#### UI Blueprint
```
+---------------------------------------+
|  <- Back to Items      New Pickup Req |
|                                       |
|  SELECTED MATERIALS (3 Items)         |
|  [Plastic x2]  [Cardboard x1]         |
|                                       |
|  PICKUP WINDOW                        |
|  Day:  [ Today ]  [ Tomorrow ] [ Day3]|
|  Slot: [ Morning 9am-12pm ]           |
|        [ (•) Afternoon 1pm-4pm ]      |
|                                       |
|  LOCATION & ADDRESS                   |
|  +---------------------------------+  |
|  | [ MapLibre Pin Picker View ]    |  |
|  | ( O ) Drag pin to your house    |  |
|  | [ (Locate Me) ]                 |  |
|  +---------------------------------+  |
|  [v] Within Service Area: Kinta (Ipoh)|
|                                       |
|  House / Unit Number                  |
|  [ No. 14, Jalan Canning 2          ] |
|                                       |
|  Street & Neighborhood                |
|  [ Canning Garden                   ] |
|                                       |
|  Landmark (Optional)                  |
|  [ Near Canning Market 99 Speedmart ] |
|                                       |
|  Access Instructions for Collector    |
|  [ Porch gate unlocked. Bag is red. ] |
|                                       |
|  (i) Exact address is hidden from the |
|  public map and only revealed to your |
|  collector after they claim the job.  |
|                                       |
|  [     Submit Pickup Request     ]    |
+---------------------------------------+
```

#### Elements & Components
* **Summary Chips:** Recyclable categories and quantities being requested.
* **Schedule Selector:** Date choice chips (Today, Tomorrow, Day 3) and Time Slot segmented control (Morning 9am–12pm, Afternoon 1pm–4pm).
* **Interactive Pin Map:** Draggable map preview centered on GPS coordinates with a crosshair marker.
* **Geofence Status Banner:**
  * **Success:** Green checkmark: "Within Service Area: Kinta District (Ipoh City Council)".
  * **Failure:** Red alert: "Outside Service Area: SnapPick is active in Perak only. Pickup cannot be submitted."
* **Address Input Fields:**
  * House / Unit Number (e.g., "Unit B-12-04").
  * Street / Taman (e.g., "Jalan Meru Heights").
  * Landmark (e.g., "Opposite Petronas station").
  * Access Instructions (e.g., "Guardhouse registration required - quote Unit 12").
* **Privacy Assurance Banner:** Explains that exact location is protected until claim.
* **Submit CTA:** Authenticated RPC `create_pickup_request` call with loading spinner.

---

### [Screen 15] Pickup Marketplace Map Screen
* **Route:** `(tabs)/request`
* **Type:** Interactive Fullscreen Map
* **Purpose:** For community collectors to browse nearby available pickup tasks. Uses privacy-preserving 0.01-degree grid snapping (approx 1 km) to conceal exact addresses.

#### UI Blueprint
```
+---------------------------------------+
|  [Search District...]   [Filter] [List|
|                                       |
|                                       |
|                 ( 3 )                 |
|               [Grid Pin]              |
|                                       |
|                                       |
|       ( 1 )                           |
|     [Grid Pin]                        |
|                         (GPS Locate)  |
|                                       |
|  +---------------------------------+  |
|  | Canning Garden • 1.2 km away    |  |
|  | Items: [Plastic x2] [Metal x1]  |  |
|  | Window: Today, 1:00 PM - 4:00 PM|  |
|  | [ Tap to View Details & Claim ] |  |
|  +---------------------------------+  |
+---------------------------------------+
| [Home] [Activity] [Scan] [Map] [Prof] |
+---------------------------------------+
```

#### Elements & Components
* **Map Engine:** MapLibre Native rendering vector tiles.
* **Top Toolbar:**
  * District search bar.
  * Material filter pill (e.g., "Plastics only", "Cardboard only").
  * View Toggle button: Switch between **Map View** and **List View**.
* **Privacy-Masked Map Pins:**
  * Green circular marker with request count badge (e.g. `( 3 )` indicates 3 requests snapped to that ~1km grid cell).
  * Unique amber icon for user's own requests (labeled "My Request", cannot be self-claimed).
* **Floating Controls:** "Locate Me" GPS compass button.
* **Realtime Sync Pill:** Top-right micro-pill: "Live" (Green dot) or "Connecting" (Amber dot).
* **Bottom Preview Card:** Shows when a pin is selected (approximate area, distance, materials summary, and CTA to expand).

---

### [Screen 16] Pickup Marketplace List View
* **Route:** Toggle state from Marketplace Map
* **Type:** Scrollable List View
* **Purpose:** Accessible alternative to the map interface for low-bandwidth scenarios or quick browsing of nearby requests sorted by distance.

#### UI Blueprint
```
+---------------------------------------+
|  Nearby Pickups (8 Available)   [Map] |
|                                       |
|  +---------------------------------+  |
|  | Canning Garden • 1.2 km away    |  |
|  | Items: 3 (Plastic, Cardboard)   |  |
|  | Window: Today, 1:00 PM - 4:00 PM|  |
|  | Notes: Clean bags on porch      |  |
|  | [ Claim Pickup ]                |  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | Taman Ipoh Timur • 2.8 km away  |  |
|  | Items: 5 (Glass, Metal Cans)    |  |
|  | Window: Tomorrow Morning        |  |
|  | [ Claim Pickup ]                |  |
|  +---------------------------------+  |
|                                       |
|  [ Pull to refresh nearby jobs ]      |
+---------------------------------------+
```

#### Elements & Components
* **Header:** Total count of active available requests in district + toggle back to Map.
* **Job Cards:**
  * Neighborhood name & approximate distance.
  * Material badges with icons.
  * Pickup time window.
  * Claim button with inline claim confirmation.
* **Empty State:** Illustration of empty street: "No pending pickups in your district. Check back soon or widen your search."

---

### [Screen 17] Marketplace Pin Preview Drawer
* **Route:** Bottom drawer on Marketplace Map
* **Type:** Interactive Bottom Drawer (Detent: 40%)
* **Purpose:** Summarizes a selected pickup opportunity and provides the atomic "Claim Pickup" action.

#### UI Blueprint
```
+---------------------------------------+
|  ====== [Drag Handle] ======      [X] |
|  Pickup Request #PK-8921              |
|  Canning Garden, Kinta District       |
|  Approx. 1.2 km from your location    |
|                                       |
|  DECLARED MATERIALS                   |
|  * 2x Plastic Bottles (Clean & Dry)   |
|  * 1x Metal Biscuit Tin (Clean & Dry) |
|                                       |
|  TIME WINDOW                          |
|  Today between 1:00 PM and 4:00 PM    |
|                                       |
|  ACCESS NOTE                          |
|  "Left in blue recyclable bag by gate"|
|                                       |
|  (i) Claiming this task will reveal   |
|  exact address and GPS directions.    |
|                                       |
|  [        Claim This Pickup        ]  |
+---------------------------------------+
```

#### Elements & Components
* **Job Title & ID:** Truncated reference ID and district.
* **Distance Metric:** Distance from user's current GPS location.
* **Material Checklist:** Item names, quantities, and preparation states.
* **Claim CTA:** Triggers atomic server-side claim RPC.
* **Claim Limit Protection:** If collector already has 3 active uncompleted jobs, displays warning: "Active claim limit reached (3 max). Complete or release existing jobs before claiming more."

---

### [Screen 18] Activity Hub Screen
* **Route:** `(tabs)/activity`
* **Type:** Dual-Segment Hub
* **Purpose:** Central tracking center for both roles: requests submitted by the user ("My Requests") and tasks claimed as a collector ("Pickups I Claimed").

#### UI Blueprint
```
+---------------------------------------+
|  Activity Hub                         |
|  [  (•) My Requests  |  Claimed Jobs ]|
|                                       |
|  Filter: [ All (3) ] [ Active ] [ Done|
|                                       |
|  +---------------------------------+  |
|  | #PK-8921 • Canning Garden       |  |
|  | [ IN PROGRESS ]                 |  |
|  | Collector: Ahmad R. (En route)  |  |
|  | Items: Plastic x2, Cardboard x1 |  |
|  | [ View Live Status -> ]         |  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | #PK-8740 • Bercham              |  |
|  | [ AWAITING CONFIRMATION ]       |  |
|  | Collector uploaded proof photo. |  |
|  | [ Confirm & Complete ] [Dispute]|  |
|  +---------------------------------+  |
|                                       |
|  +---------------------------------+  |
|  | #PK-8401 • Pasir Pinji          |  |
|  | [ COMPLETED ]                   |  |
|  | Verified 3 items • +15 Points   |  |
|  +---------------------------------+  |
+---------------------------------------+
| [Home] [Activity] [Scan] [Map] [Prof] |
+---------------------------------------+
```

#### Elements & Components
* **Segmented Control Tabs:**
  * Tab A: **My Requests** (Pickups created by the user).
  * Tab B: **Pickups I Claimed** (Jobs the user volunteered to collect).
* **Filter Pills:** All, Active, Awaiting Action, Completed, Disputed/Cancelled.
* **Status Badges:**
  * `Pending` (Amber)
  * `Accepted` (Blue)
  * `In Progress` (Purple)
  * `Awaiting Confirmation` (Amber/Green pulse)
  * `Completed` (Green)
  * `Disputed` (Red)
  * `Not Collected` (Grey)
  * `Cancelled` (Grey)
* **Direct Action Buttons:** Inline buttons on cards to confirm completion, view navigation, or report disputes.

---

### [Screen 19] Claimed Pickup Fulfillment Screen (Collector View)
* **Route:** `/pickup/[id]`
* **Type:** Task Execution & Verification Screen
* **Purpose:** Dedicated working screen for the collector when traveling to, verifying, and fulfilling an accepted pickup. Unlocks exact address and manages line-item verification and proof photo capture.

#### UI Blueprint
```
+---------------------------------------+
|  <- Back to Jobs        Pickup Details|
|  Status: [ IN PROGRESS ]              |
|                                       |
|  EXACT DESTINATION (UNLOCKED)         |
|  No. 14, Jalan Canning 2,             |
|  Canning Garden, 31400 Ipoh, Perak    |
|  Note: "Porch gate unlocked. Bag red."|
|                                       |
|  [ (Nav) Open Google Maps / Waze ]    |
|                                       |
|  +---------------------------------+  |
|  | [ Route Map Preview ]           |  |
|  +---------------------------------+  |
|                                       |
|  VERIFY COLLECTED ITEMS               |
|  +---------------------------------+  |
|  | Plastic Bottles (Requested: 2)  |  |
|  | Collected Qty: [ - ]  2  [ + ]  |  |
|  | Condition: [ (•)Clean ( )Dirty ]|  |
|  +---------------------------------+  |
|  | Cardboard Box   (Requested: 1)  |  |
|  | Collected Qty: [ - ]  1  [ + ]  |  |
|  | Condition: [ (•)Clean ( )Dirty ]|  |
|  +---------------------------------+  |
|                                       |
|  PROOF OF PICKUP PHOTO                |
|  [ (Camera) Take Proof Photo       ]  |
|  [Preview: proof_photo.jpg - EXIF off]|
|                                       |
|  [ Submit Proof & Complete Job ]      |
|  [ Release Job Back to Pool ]         |
+---------------------------------------+
```

#### Elements & Components
* **Status Banner:** Shows current state (`accepted` or `in_progress`) with "Start Pickup" transition button.
* **Unlocked Private Address Card:**
  * Unit, street, landmark, and requester's access instructions.
  * Navigation Intent Button: Directly launches Google Maps or Waze with exact coordinates.
* **Collection Checklist Table (`CollectionChecklist`):**
  * Line-by-line verification for each item.
  * Collected quantity stepper `[ - ] [ N ] [ + ]`.
  * Verified condition selector (`clean_dry` / `contaminated_wet` / `broken_unsafe`).
  * If collected count is set to 0: Triggers mandatory "Non-collection reason" dropdown (`contaminated`, `missing`, `unsafe`).
* **Proof Photo Capture Section:**
  * Camera launcher to photograph the collected bag or evidence of non-collection.
  * Automatically strips EXIF/GPS metadata and downsamples to 800px width.
* **Action CTAs:**
  * Primary: "Submit Proof & Complete Job" (Transitions state to `awaiting_confirmation`).
  * Secondary: "Release Job" (Allows collector to return job to pool if unable to fulfill).

---

### [Screen 20] Requester Proof Verification Screen
* **Route:** `/pickup/[id]/verify`
* **Type:** Review & Confirmation Screen
* **Purpose:** Resident reviews collector-submitted proof and checklist verification before releasing points/completion.

#### UI Blueprint
```
+---------------------------------------+
|  <- Back              Verify Pickup ✅|
|                                       |
|  Your collector has completed pickup! |
|  Please inspect the proof photo below.|
|                                       |
|  +---------------------------------+  |
|  |                                 |  |
|  |     [ Proof Photo Preview ]     |  |
|  |      (Tap to pinch-to-zoom)     |  |
|  |                                 |  |
|  +---------------------------------+  |
|  Uploaded Today at 14:22 by Ahmad R.  |
|                                       |
|  COLLECTION SUMMARY                   |
|  * Plastic Bottles: 2/2 Collected (OK)|
|  * Cardboard: 1/1 Collected (OK)      |
|                                       |
|  Auto-completion in: 47h 58m          |
|                                       |
|  [   Confirm Pickup Completed   ]     |
|                                       |
|  [ Report a Problem / Raise Dispute ] |
+---------------------------------------+
```

#### Elements & Components
* **Proof Photo Viewer:** Full-width image display with modal pinch-to-zoom capability.
* **Verification Breakdown:** Displays the collector's recorded counts and verified conditions.
* **Countdown Timer:** "Auto-completes in 48 hours if no action taken."
* **Confirm CTA:** Moves state to `completed`, logs positive feedback, and increments impact stats.
* **Dispute Button:** Destructive text button that opens the dispute submission flow.

---

### [Screen 21] Dispute & Issue Reporting Modal
* **Route:** Modal overlay from Verification Screen
* **Type:** Bottom Sheet / Full-Screen Modal
* **Purpose:** Handles cases where waste was not collected, bags were damaged, or proof was invalid. Creates an administrative review ticket.

#### UI Blueprint
```
+---------------------------------------+
|  ====== [Drag Handle] ======      [X] |
|  Report an Issue / Dispute            |
|  Pickup #PK-8740                      |
|                                       |
|  What went wrong?                     |
|  ( ) Waste was not collected          |
|  ( ) Incomplete items collected       |
|  ( ) Proof photo is invalid or blank  |
|  ( ) Property or safety issue         |
|  ( ) Other issue                      |
|                                       |
|  Additional Details                   |
|  [ Explain what happened...         ] |
|                                       |
|  Attach Photo Evidence (Optional)     |
|  [ + Upload Photo ]                   |
|                                       |
|  (i) Admins review disputes within    |
|  24 hours. The job will be frozen.    |
|                                       |
|  [      Submit Dispute Case     ]     |
+---------------------------------------+
```

#### Elements & Components
* **Dispute Reason Radio Group:** Standardized dispute categories.
* **Explanation Input:** Multi-line text area (minimum 10 characters).
* **Evidence Uploader:** Allows resident to attach photo evidence of uncollected bags.
* **Submit CTA:** Moves request status to `disputed` and registers ticket in admin dispute queue.

---

### [Screen 22] Profile & Settings Screen
* **Route:** `(tabs)/profile`
* **Type:** Profile & Settings Hub
* **Purpose:** Manages user account details, privacy controls, continuous learning consent, diagnostic model telemetry, and account deletion.

#### UI Blueprint
```
+---------------------------------------+
|  Profile & Settings                   |
|                                       |
|  +---------------------------------+  |
|  | [Avatar: AH] Ady Ha             |  |
|  | ady@example.com                 |  |
|  | Community Recycler • Kinta      |  |
|  +---------------------------------+  |
|                                       |
|  PERSONAL DETAILS                     |
|  Display Name: [ Ady Ha             ] |
|  Phone Number: [ +60 12-345 6789    ] |
|  [ Save Profile Details ]             |
|                                       |
|  PRIVACY & CONTINUOUS LEARNING        |
|  Store Scans in Cloud History [ (•) ] |
|  Help Improve SnapPick AI     [ (•) ] |
|  Daily Upload Quota: 4 / 10 used      |
|  "Images are stripped of EXIF/GPS"    |
|                                       |
|  DIAGNOSTICS & SYSTEM                 |
|  Active Model: M0 (YOLOv8n-bundled)   |
|  Model Hash: e3b0c44298fc1c14...      |
|  Rule Set: Perak SAS v1.2.0           |
|  [ Flush Offline Sync Queue (0) ]     |
|                                       |
|  LEGAL & SECURITY                     |
|  * Terms of Service                   |
|  * Privacy Policy                     |
|  [ Sign Out ]                         |
|  [ Delete Account & All Data ]        |
+---------------------------------------+
| [Home] [Activity] [Scan] [Map] [Prof] |
+---------------------------------------+
```

#### Elements & Components
* **Profile Header:** Avatar with user initials, full name, email, and user community badge.
* **Editable Fields:** Display name and phone number with "Save Profile Details" button.
* **Privacy & AI Retraining Card:**
  * Cloud scan history switch.
  * Continuous learning training opt-in switch ("Help improve SnapPick").
  * Daily upload quota indicator.
* **Model & Diagnostics Card:**
  * Active model version label (e.g., `M0 Bundled Fallback`).
  * Checksum hash pill (SHA-256).
  * Active SAS rule-set version.
  * Offline queue flush button with pending item counter.
* **Danger Zone:**
  * "Sign Out" button.
  * "Delete Account & All Data" (triggers double-confirmation dialog complying with data erasure mandates).

---

### [Screen 23] Offline Notification & Status Banner
* **Route:** Global Toast / Floating Banner
* **Type:** Dynamic System Banner (Top-docked)
* **Purpose:** Communicates offline status without interrupting camera scanning or SAS guidance.

#### UI Blueprint
```
+---------------------------------------+
| [WifiOff Icon] You are offline        |
| Camera scanning & SAS guides active.  |
| Submitting pickups requires internet. |
+---------------------------------------+
```

#### Elements & Components
* **Banner Surface:** Amber/Slate background (`#0F172A` with `#F59E0B` icon).
* **Microcopy:** Clarifies that on-device YOLO detection and SAS preparation guides work with zero connectivity, while marketplace actions are paused.

---

### [Screen 24] Hardware Permission Request Dialogs
* **Route:** System Dialogs & Fallback Views
* **Type:** Educational Pre-Permission Modals

#### 24.1 Camera Permission Modal
* **Headline:** "Enable Camera for Waste Sorting"
* **Illustration:** Scanner reticle with clean recyclable bottle.
* **Body:** "SnapPick uses your camera to run real-time waste classification on your device. Photos remain private."
* **CTAs:** `[ Enable Camera ]` (Triggers OS prompt) / `[ Not Now ]`.

#### 24.2 Location Permission Modal
* **Headline:** "Enable Location for Community Pickups"
* **Illustration:** Map pin over Perak district boundary.
* **Body:** "We use your location to confirm service availability in Perak municipal districts and connect you with nearby collectors."
* **CTAs:** `[ Share Precise Location ]` / `[ Cancel ]`.

---

### [Screen 25] System Empty, Error, & Rejection States

#### 25.1 Geofence Rejection State (Outside Perak Polygon)
* **Trigger:** User sets pickup pin outside Perak service polygons.
* **Headline:** "Location Outside Service Area 📍"
* **Description:** "SnapPick community pickups are currently active exclusively within Perak municipal districts (Ipoh, Taiping, Kinta). Camera scanning and SAS guides remain available everywhere."
* **Action:** `[ Adjust Pin on Map ]` / `[ Dismiss ]`.

#### 25.2 Active Claims Exceeded Error
* **Trigger:** Collector attempts to claim a 4th job while 3 are pending/in progress.
* **Headline:** "Active Claim Limit Reached"
* **Description:** "To ensure prompt community collection, each collector can have up to 3 active pickups at a time. Please complete or release one of your current pickups first."
* **Action:** `[ View Claimed Jobs in Activity ]`.

#### 25.3 Empty Marketplace State
* **Trigger:** No available requests in the selected district.
* **Headline:** "No Pickups Available Right Now 🌿"
* **Description:** "There are no pending pickups in this area. Check back later or scan your own recyclables to post a request."
* **Action:** `[ Scan My Recyclables ]`.

---

### [Screen 26] Public Web Dashboard (Companion View)
* **Route:** `/` (Web Next.js Dashboard - Phase 13)
* **Type:** Responsive Web Dashboard (Desktop & Tablet)
* **Purpose:** Publicly accessible transparency portal showcasing municipal recycling impact, material distribution, and district heatmaps without authentication.

#### UI Blueprint
```
+------------------------------------------------------------------------+
|  SnapPick Public Portal        [Perak District: All v]   [About Model] |
|                                                                        |
|  COMMUNITY RECYCLING IMPACT                                            |
|  +--------------------+ +--------------------+ +--------------------+  |
|  |    14,892 kg       | |     3,412          | |     428            |  |
|  | Total Recycled     | | Completed Pickups  | | Active Collectors  |  |
|  +--------------------+ +--------------------+ +--------------------+  |
|                                                                        |
|  DISTRICT ACTIVITY MAP                 MATERIAL BREAKDOWN              |
|  +----------------------------------+  +----------------------------+  |
|  |                                  |  | [ Donut Chart ]            |  |
|  |     [ PostGIS Snapped Heatmap    |  | * Plastic: 44%             |  |
|  |       Aggregations by District]  |  | * Cardboard: 28%           |  |
|  |       * Kinta (High)             |  | * Metal: 16%               |  |
|  |       * Larut & Matang (Med)     |  | * Glass: 12%               |  |
|  |                                  |  +----------------------------+  |
|  +----------------------------------+                                  |
|                                                                        |
|  MODEL GOVERNANCE & TELEMETRY                                          |
|  * Active Champion: M0-Baseline | Golden Set mAP@50: 82.4% | Edge Sync |
+------------------------------------------------------------------------+
```

#### Elements & Components
* **Public Key Metrics:** Real-time counters showing total kilograms collected, verified pickups, and active community members.
* **District Map Heatmap:** PostGIS-rendered aggregate heat zones (never exposes individual addresses or pins).
* **Material Breakdown Chart:** Interactive SVG donut chart detailing proportions of collected plastic, paper, cardboard, metal, and glass.
* **Model Governance Footer:** Transparent metrics display showing active model checksum and frozen evaluation test scores.

---

## 4. Figma Implementation Guide & Auto-Layout Specifications

When creating components in Figma from this document, apply these exact structural properties:

### 4.1 Global Design Tokens
* **Base Grid:** 8dp grid (Sub-elements align to 4dp).
* **Corner Radii:**
  * Buttons & Inputs: `8px` (`rounded-lg`)
  * Cards & Containers: `12px` (`rounded-xl`)
  * Bottom Sheets: `20px` top corners (`rounded-t-2xl`)
  * Status Pills & Badges: `9999px` (`rounded-full`)
* **Typography Scale (Inter / SF Pro):**
  * `Display Title`: 28sp / Line-height 34sp / Bold
  * `Screen Header`: 22sp / Line-height 28sp / Semi-Bold
  * `Section Header`: 18sp / Line-height 24sp / Semi-Bold
  * `Card Title`: 16sp / Line-height 22sp / Medium
  * `Body Text`: 14sp / Line-height 20sp / Regular
  * `Caption / Badge`: 12sp / Line-height 16sp / Medium
  * `Micro Timestamp`: 10sp / Line-height 14sp / Regular

### 4.2 Auto-Layout Structures for Figma
1. **Button (Primary):**
   * Auto-layout: Horizontal, Padding: `16px` Left/Right, `14px` Top/Bottom, Gap: `8px`.
   * Fill: `#16A34A`, Corner radius: `8px`. Text: `14sp` Bold `#FFFFFF`.
2. **Detected Item Card (Review Sheet Row):**
   * Auto-layout: Vertical, Padding: `12px`, Gap: `10px`.
   * Fill: `#FFFFFF`, Stroke: `1px solid #E2E8F0`, Corner radius: `12px`.
   * Internal Row 1: Horizontal Auto-layout (Icon + Title + Confidence Pill + Spacer + Delete Button).
   * Internal Row 2: Horizontal Segmented Control (Condition states).
3. **Bounding Box Frame (Scanner Overlay):**
   * Dimensions: Absolute position matching normalized coordinates.
   * Stroke: `2px solid #16A34A` (or `#D97706` / `#DC2626`).
   * Attached Top-Left Tag: Horizontal Auto-layout, Padding: `2px 6px`, Fill: `#16A34A`, Text: `10sp` Bold `#FFFFFF`.

---

## 5. Screen Inventory Matrix (Checklist for Figma Designers)

| ID | Screen / Component Name | Type | Figma Frame Name | Status |
|---|---|---|---|---|
| 01 | Splash & Boot Screen | Screen | `01_Splash` | Specified |
| 02 | Onboarding Carousel (3 Steps) | Screen | `02_Onboarding` | Specified |
| 03 | Sign In Screen | Screen | `03_SignIn` | Specified |
| 04 | Sign Up Screen | Screen | `04_SignUp` | Specified |
| 05 | Password Reset Sheet | Bottom Sheet | `05_PasswordReset` | Specified |
| 06 | Community Safety Acknowledgement | Screen | `06_ConsentSafety` | Specified |
| 07 | Image Storage & AI Consent | Screen | `07_ConsentStorage` | Specified |
| 08 | Home Dashboard Screen | Tab Screen | `08_HomeDashboard` | Specified |
| 09 | SnapBot AI Chat Modal | Bottom Sheet | `09_SnapBotModal` | Specified |
| 10 | Camera Scan Viewfinder | Tab Screen | `10_ScanViewfinder` | Specified |
| 11 | Scan Processing Loading Overlay | Overlay | `11_ScanProcessing` | Specified |
| 12 | Scan Results Visualizer | Screen | `12_ScanVisualizer` | Specified |
| 13 | Review Items Bottom Sheet | Bottom Sheet | `13_ReviewItemsSheet` | Specified |
| 14 | Create Pickup Request Flow | Screen | `14_CreatePickup` | Specified |
| 15 | Pickup Marketplace Map | Tab Screen | `15_MarketplaceMap` | Specified |
| 16 | Pickup Marketplace List View | Screen | `16_MarketplaceList` | Specified |
| 17 | Marketplace Pin Detail Drawer | Bottom Sheet | `17_MarketplacePinDetail` | Specified |
| 18 | Activity Hub (Dual Segment) | Tab Screen | `18_ActivityHub` | Specified |
| 19 | Claimed Pickup Fulfillment (Collector) | Screen | `19_ClaimedPickupJob` | Specified |
| 20 | Requester Proof Verification | Screen | `20_RequesterVerification`| Specified |
| 21 | Dispute & Issue Reporting Modal | Modal | `21_DisputeModal` | Specified |
| 22 | Profile & Settings Screen | Tab Screen | `22_ProfileSettings` | Specified |
| 23 | Offline Notification Banner | Component | `23_OfflineBanner` | Specified |
| 24 | Hardware Permission Dialogs | Modals | `24_PermissionModals` | Specified |
| 25 | System Error & Empty States | Components | `25_EmptyErrorStates` | Specified |
| 26 | Public Web Dashboard (Desktop) | Web Screen | `26_PublicWebDashboard` | Specified |

---
*End of Interface Specification. Ready for import into Figma or AI UI/UX generation prompts.*

