# VIT SMART Attendance Segregator

> **Office of Innovation, Startup & Technology Transfer (VIT-IST)**  
> Intelligent multi-event attendance segregation and Excel generation web app built with **React (Vite)** and **Node.js (Express)** on **Firebase** (Hosting + 2nd Gen Cloud Functions).

---

## 🌟 Key Features

1. **Multi-File Excel Parsing (Drag & Drop)**:
   - Upload multiple `.xlsx` / `.xls` files simultaneously with up to **20 MB** memory limit per request.
   - Files are parsed entirely in memory (no disk storage, no databases, no credentials retained).
2. **Intelligent Event & Metadata Extraction**:
   - Parses single-event or multiple stacked blocks per sheet (e.g., "Makerspace for kids - Day 1", "Day 2", etc.).
   - Extracts dates and timings from complex strings (e.g. `Venue: TT Gallery | Date 08 Oct 2026 | Time : 3pm to 5 pm`, `Date: 21.10.2026 | Timings: 8 AM - 7:20 PM`, or embedded dates in title/filename).
   - Normalizes dates to `DD Mon YYYY` (e.g. `07 Oct 2026`).
   - Normalizes times to `H:MM AM/PM – H:MM AM/PM` (e.g. `2:00 PM – 7:20 PM`).
   - Drops venue details from the output cleanly.
3. **Registration Number Validation & Deduplication**:
   - Validates regex `/^\d\d[A-Za-z]{3}\d{4}$/` (checks Column B first, then any column).
   - Deduplicates registration numbers within each event block and reports duplicate counts.
   - Detects identical/copy files (same event and student list) and skips duplicates.
4. **Automated Branch-to-School Mapping**:
   - Extracts branch code from characters 3–5 of the registration number (e.g. `25BCE0014` → `BCE`).
   - Matches against centralized `functions/config/schools.json`.
   - Any unmapped branch code is bucketed into `UNKNOWN_SCHOOL.xlsx` with warnings.
   - Warns if the sheet's school column contradicts the branch mapping.
   - Built-in UI Branch Mapping Editor lets users add or customize branch codes (saved in `localStorage` and sent with requests).
5. **Interactive Preview Table & Metadata Fallbacks**:
   - View extracted event names, normalized dates, timings, valid students, duplicates removed, and skipped rows before generating.
   - Edit event titles, dates, and times inline as fallbacks for messy or unstructured titles.
6. **Strict Excel Output & Summary Specification**:
   - Generates one Excel file per school with students: `SCOPE.xlsx`, `SENSE.xlsx`, ... `UNKNOWN_SCHOOL.xlsx`.
   - Sheet named after school, events ordered chronologically.
   - Row 1: Event Name (Calibri 12, Bold, black, no fill).
   - Row 2: `Date <date> | Time : <time>` (Light blue fill `#D9E1F2` in Column A only).
   - Row 3: Branch codes side-by-side (Calibri 11, Bold, yellow fill `#FFE699` on header cells only).
   - Row 4+: Reg numbers under branch columns, sorted by year prefix then number.
   - One blank row after the longest column before the next event.
   - Column A width: 46; other columns: 18.
   - Generates `SEGREGATION_SUMMARY.txt` with school counts sorted descending and date range.
   - Streamed directly as `all_schools_<firstDate>_to_<lastDate>.zip` (using `YYYY-MM-DD`).

---

## 🏗️ Architecture & Project Structure

```
├── firebase.json              # Firebase Hosting & 2nd Gen Function rewrite configuration
├── .firebaserc                # Firebase project identifier
├── package.json               # Root helper scripts for build and local run
├── README.md                  # Comprehensive setup and deployment documentation
│
├── functions/                 # Backend (Express on Firebase Cloud Functions 2nd Gen)
│   ├── config/
│   │   └── schools.json       # Centralized branch-to-school mapping
│   ├── index.js               # Express application & onRequest Cloud Function export
│   ├── parser.js              # Excel parsing, stacked blocks, normalization engine
│   ├── segregate.js           # Student segregation, deduplication, chronological sorting
│   ├── excelWriter.js         # ExcelJS workbook generation matching exact styling
│   ├── summary.js             # Formats SEGREGATION_SUMMARY.txt
│   └── package.json           # Backend dependencies (exceljs, multer, archiver, etc.)
│
└── frontend/                  # Frontend (React + Vite + Vanilla CSS)
    ├── index.html             # HTML5 entry with Google Fonts (Outfit & Plus Jakarta Sans)
    ├── vite.config.js         # Vite config with local proxy to /api
    ├── package.json           # Frontend dependencies
    └── src/
        ├── App.jsx            # Main Single-Page UI (Dropzone, Preview, Editor, Download)
        ├── index.css          # Modern dark-mode glassmorphic design system
        └── main.jsx           # React DOM root mounting
```

---

## 📋 Default Branch-to-School Mapping

Stored in `functions/config/schools.json`:

| School | Registered Branch Codes |
|---|---|
| **SENSE** | `BVD`, `BEC`, `BML` |
| **SCOPE** | `BBS`, `BDS`, `BCT`, `BCB`, `MIC`, `BAI`, `MID`, `BCI`, `BKT`, `BCE` |
| **SCORE** | `BIT`, `BCA`, `BCS`, `MCA`, `MAG`, `BYB`, `BDE`, `MIS` |
| **SAS** | `MDT`, `MSP` |
| **SELECT** | `BEE`, `BEL`, `BEI`, `MAC` |
| **SMEC** | `MMT`, `BMV`, `BST`, `BMA`, `BME`, `BMM` |
| **SBST** | `BBT`, `MSI`, `MFI` |
| **SCE** | `BCL` |
| **SHINE** | `BHT` |
| **SCHEME** | `BCM` |
| **VAIAL** | `BAG` |
| **SSL** | `BFN`, `BBC`, `BCC`, `BBP` |
| **VITBS** | `BBA`, `MBA` |
| **HOT** | `BHA` |
| **VSMART** | `BVC`, `BAM` |
| **V-SIGN** | `BID` |
| **V-SPARC** | `BARC` |
| **UNKNOWN_SCHOOL** | Any unrecognized branch code |

---

## 🚀 Local Development

### Option A: Standalone Node + Vite (Fastest for UI/Logic Iteration)

1. **Install Dependencies**:
   ```bash
   # From root:
   npm run install:all
   ```

2. **Start Backend (Port 5000)**:
   ```bash
   npm run start:backend
   ```

3. **Start Frontend (Port 3000)**:
   ```bash
   npm run start:frontend
   ```

4. Open your browser at `http://localhost:3000`. Requests to `/api/**` are automatically proxied to `http://localhost:5000`.

---

### Option B: Firebase Local Emulators

1. Ensure the Firebase CLI is installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Build the frontend production bundle:
   ```bash
   npm run build
   ```

3. Start the Firebase Emulators:
   ```bash
   firebase emulators:start
   ```

4. Open Hosting on `http://localhost:5000` and Emulator UI on `http://localhost:4000`.

---

## ☁️ 100% Free Firebase Deployment (Spark Plan - No Credit Card / No Pay-As-You-Go)

You can deploy the Attendance Segregator completely **FREE** on the Firebase **Spark Plan** without entering any credit card or signing up for Pay-As-You-Go!

### Why this works:
- **Firebase Hosting** is 100% FREE on the Spark plan (up to 10 GB storage and 360 MB/day transfer).
- The web app includes a built-in **In-Browser Processing Engine** powered by `ExcelJS` and `JSZip`. When deployed on Firebase Hosting without Cloud Functions, all Excel parsing, multi-event segmentation, deduplication, school workbook formatting, and ZIP generation run **directly inside the client's browser memory** in milliseconds.
- **Zero data sent over the internet**: Attendance files remain entirely on the user's computer for complete privacy and instant speed.

---

### Step-by-Step Free Deployment:

#### Step 1: Create a Free Project in Firebase
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and enter a project name (e.g., `vit-attendance-segregator`).
3. Leave it on the default **Spark Plan (Free)**. *(Do NOT click upgrade).*

#### Step 2: Log in with Firebase CLI
In your terminal:
```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Log in to your Google / Firebase account
firebase login
```

#### Step 3: Link Your Firebase Project
```bash
firebase use --add
```
Select your newly created project from the list and give it the alias `default`.

#### Step 4: Build the React Application
```bash
npm run build
```
This builds and packages the React frontend, official VIT/IIC banner, and client-side processing engine into `frontend/dist/`.

#### Step 5: Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```

Your live app will be published immediately at:
```
✔  Deploy complete!

Hosting URL: https://<your-project-id>.web.app
```

---

## ⚡ Optional: Deploying with Firebase Cloud Functions (Blaze Plan)
If you ever want the Express backend deployed as a Cloud Function:
1. Upgrade your Firebase project to the **Blaze Plan** in the console.
2. Replace `firebase.json` with `firebase.blaze.json`.
3. Run `firebase deploy`.

---

## 🧪 Testing with Sample Files

The web app includes an instant **"Load Sample"** button in the header that generates an in-memory sample Excel file containing:
- Multi-block day sessions (`Day 1` and `Day 2`)
- Mixed branch students (`SCOPE`, `SENSE`, `SELECT`)
- Internal duplicates (automatically removed and flagged)
- Discrepancy demo (student with `BCE` branch code marked as `SMEC` in sheet)
- Unknown branch code (`ZZZ` routed to `UNKNOWN_SCHOOL.xlsx`)

You can also drop your own department Excel attendance sheets directly onto the dropzone.
