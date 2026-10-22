# Implementation Plan: AI Agent Self-Learning Playbook & Bengali Knowledge Hub

## Overview
Build an autonomous **Bengali AI Knowledge Hub & Self-Learning Strategy Playbook (স্বয়ংক্রিয় এআই নলেজ হাব ও সেলফ-লার্নিং স্ট্র্যাটেজি প্লেবুক)** for TradePulse. The AI Agent will dynamically document its technical analysis methods, candlestick rules, indicator combinations, and market strategies in clear, structured Bengali. These records are persistently stored in the system database and local storage so that:
1. **The User** can read, search, and learn professional trading strategies in Bengali.
2. **The AI Agent** actively reads and follows its own documented rules during live chart analysis.
3. **Continuous Self-Correction Loop**: When a signal or trade results in a loss or mistake, the Agent conducts an automated post-trade post-mortem in Bengali, explains *why* the setup failed, penalizes the pattern's confidence weight, and records cautionary constraints to prevent repeating the mistake.

---

## User Review Required

> [!NOTE]
> Since the clarifying questions were skipped, this plan adopts the recommended architectural defaults:
> - A dedicated **"AI Knowledge Hub (এআই নলেজ হাব)"** accessible from the top navigation bar.
> - A semi-automatic 1-click outcome verification (WIN / LOSS) on trade signals and live screens to immediately trigger the Agent's self-learning post-mortem.
> - Bengali explanations saved alongside structured rule definitions, confidence weights, and historical success rates.

---

## Architecture & Proposed Changes

### 1. Data Schema & Knowledge Persistence (`src/types/learningTypes.ts` & `server/types/knowledgeTypes.ts`)
Define structured schemas for self-learned strategies and mistake reflections:
- **`LearnedStrategyRule`**:
  - `ruleId`: Unique string identifier
  - `titleBn`: Bengali rule title (e.g., "ইএমএ ২০ বাউন্স ও বুলিশ এনগালফিং রিভার্সাল")
  - `category`: `CANDLESTICK` | `INDICATOR` | `SUPPORT_RESISTANCE` | `PRICE_ACTION` | `OTC_TRAP`
  - `conditionsBn`: Array of step-by-step entry triggers written in plain Bengali
  - `confidenceWeight`: Current dynamic confidence (0.0 to 1.0, adjusted automatically)
  - `totalTrades`: Number of times this strategy was deployed
  - `winCount` / `lossCount`: Historical performance tracking
  - `cautionaryNotesBn`: Lessons learned from past mistakes (e.g., "ডাউনট্রেন্ড চলাকালীন এই প্যাটার্ন এড়িয়ে চলুন")
  - `lastUpdated`: Timestamp
  - `status`: `ACTIVE` | `UNDER_REVIEW` | `REVISED`

- **`TradeMistakeReflection`**:
  - `reflectionId`: Unique ID
  - `timestamp`: Date & time of the mistake
  - `symbol`: Asset pair (e.g., `EUR/USD OTC`)
  - `direction`: Expected direction (`CALL` / `PUT`)
  - `failureReasonBn`: AI's honest Bengali explanation of why the trade failed (e.g., "রেজিস্ট্যান্স জোনে সেলার্স রিজেকশন মিস করায় লস হয়েছে")
  - `correctiveActionBn`: What the AI updated in its strategy to prevent this in the future
  - `adjustedRuleId`: Rule that was updated

---

### 2. Backend Knowledge & Self-Learning Engine (`server/services/dailyLearningService.ts` & `server/routes/agent.ts`)
- **Knowledge API Endpoints**:
  - `GET /api/agent/learned-rules`: Retrieve all active and revised strategies in Bengali.
  - `POST /api/agent/learned-rules`: Create or revise a strategy rule.
  - `POST /api/agent/reflect-mistake`: Ingest a failed trade, invoke Gemini Vision / Technical Reflection to analyze the failure, generate Bengali diagnostic text, and update rule weights.
- **Rule Adaptation Algorithm**:
  - When a loss is registered, the rule's confidence is decremented by 5–8%, and cautionary criteria are appended to `cautionaryNotesBn`.
  - When a win is registered, successful pattern validation increases confidence by 2–4%.
  - The AI Agent's screen analyzer (`screenVerificationService.ts` and `liveScreenService.ts`) queries these rules and cross-checks them before issuing signals!

---

### 3. Frontend Bengali Knowledge Hub (`src/components/BengaliKnowledgeHub.tsx`)
Create a responsive, high-density dashboard matching TradePulse's visual design:
- **Rule Cards & Taxonomy**:
  - Filter by category (`সকল নিয়ম`, `ক্যান্ডেলস্টিক`, `ইন্ডিকেটর`, `সাপোর্ট/রেজিস্ট্যান্স`, `ভুল থেকে শিক্ষা`).
  - Interactive rule view displaying Bengali entry criteria, win rates (`font-mono tabular-nums`), and dynamic confidence gauges.
  - Clear, unboxed metadata typography following frontend-design guidelines.
- **Mistake Learning Log (ভুল বিশ্লেষণ ও পোস্ট-মর্টেম ডায়েরি)**:
  - Chronological list of AI mistakes and reflections.
  - Transparent badges showing: "ভুল শনাক্ত" -> "কারণ বিশ্লেষণ" -> "স্ট্র্যাটেজি সংশোধন".
- **Interactive Feedback Controls**:
  - Allow user to trigger "নতুন নিয়ম যোগ করুন" or test the Agent's self-learning response.
  - Download / Export Knowledge Base as JSON or print-friendly format for offline study.

---

### 4. Integration with Header Navigation & Live Screen Analyzer
- **Header Navigation (`src/components/Header.tsx` & `src/App.tsx`)**:
  - Add an intuitive navigation tab: **"Knowledge (নলেজ হাব)"** with book icon (`BookOpen`), maintaining single-line alignment and touch accessibility.
- **Feedback Buttons on Live Screen Analyzer & Signal Hero Card**:
  - Add quick **"Win (লাভ)"** / **"Loss (ভুল সিগন্যাল)"** outcome buttons under the latest signal.
  - When the user or system marks "Loss", the AI immediately triggers the self-learning reflection, explains the mistake in Bengali, and displays the updated rule.

---

## 5. Unified All-Screen Floating HUD Bubble (একক ভাসমান বাবল - সব অ্যাপ ও স্ক্রিনের ওপর দৃশ্যমান)

### User Pain Points Resolved:
1. **Single Bubble Discipline**: Eliminated redundant secondary buttons like "সকল স্ক্রিনে AI HUD" and in-DOM overlay clones. There is strictly **ONE** active floating bubble at any time.
2. **True OS-Level Floating (Always-On-Top)**:
   - On Desktop Chromium (Chrome, Edge): Uses native **Document Picture-in-Picture** (`documentPictureInPicture.requestWindow()`) to open a persistent, floating Always-On-Top widget.
   - On Mobile / Android Chrome: Uses continuous 30fps HTML5 Canvas streaming into **Video Picture-in-Picture** (`HTMLVideoElement.requestPictureInPicture()`) to float as an OS PiP widget.
   - On Native Android APK: Uses Android `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` to float natively above Quotex, Binomo, MT4, and other apps.
3. **User Gesture Expiry Solved**:
   - In web browsers, Picture-in-Picture requires an active transient user gesture (`navigator.userActivation.isActive`).
   - Previously, waiting for `await getDisplayMedia()` expired the click gesture before launching PiP.
   - Solved by initiating `pictureInPictureService.requestFloatingOverlay()` synchronously during the user's initial click on "Connect Live Screen" or "ডেমো টেস্ট স্ট্রিম", or directly on clicking/tapping the floating bubble.
4. **Single-Bubble Rendering Sync**:
   - When the OS-level PiP window is active (`isPipActive === true`), the in-page DOM bubble gracefully renders `null`.
   - When the user closes the floating window, the in-page bubble immediately restores without page reloads.

### Verification State:
- `lint_applet` (`tsc --noEmit`): Passed with 0 errors.
- `compile_applet`: Build succeeded cleanly.
- Dev server running on port 3000.

