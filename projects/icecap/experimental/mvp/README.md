# Icecap MVP - Residential Real Estate Investment Analyzer

This is an experimental MVP implementation of the Residential Real Estate Investment Analyzer (Icecap).

## Core Features
- **Multi-Platform Scraping**: Supports data extraction from Redfin, Zillow, and Realtor.com.
- **Sidepanel UI**: A dedicated interface that stays with you while you browse property listings.
- **Rental & Flip Calculators**: Real-time updates for Cash Flow, Cap Rate, CoC Return, ROI, and MAO (Maximum Allowable Offer).
- **AI Analysis**: Uses Gemini 1.5 Flash to summarize listings and identify potential red flags in the description.
- **Heuristic Rent Estimator**: Automatically estimates rent based on property price (placeholder Cloud Function).
- **Data Persistence**: Save properties to Firebase (Firestore) and export them as CSV.

## Technical Stack
- **Framework**: React + Plasmo (Chrome Extension Framework)
- **Styling**: Tailwind CSS + Lucide Icons
- **State Management**: Zustand
- **Backend**: Firebase Auth, Firestore, and Cloud Functions
- **AI**: Google Gemini (via `@google/generative-ai`)

## Setup & Development
1. **Clone and Install Dependencies**:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```
2. **Environment Variables**: Create a `.env` file in `experimental/mvp/` and add:
   ```env
   PLASMO_PUBLIC_GEMINI_API_KEY=your-api-key
   ```
3. **Run in Development**:
   ```bash
   npm run dev
   ```
   This will start the Plasmo build watcher.

4. **Install in Chrome**:
   - Open Chrome and type `chrome://extensions/` in the address bar.
   - Toggle **Developer mode** to **ON** in the top right.
   - Click **Load unpacked** and select the folder: `icecap/experimental/mvp/build/chrome-mv3-dev`.
   - Navigate to a property on [Redfin](https://www.redfin.com), [Zillow](https://www.zillow.com), or [Realtor.com](https://www.realtor.com).
   - Click the extension icon and select **Open Side Panel**.

5. **Run Firebase Emulators**:
   ```bash
   firebase emulators:start --project demo-project
   ```
   *Note: Requires Java to be installed.*

## Testing
Core calculation logic is verified with Vitest:
```bash
npm test
```

## Project Structure
- `contents/`: Content scripts for site-specific scrapers.
- `core/`: Firebase configuration, Zustand store, and business logic.
- `functions/`: Firebase Cloud Functions for backend logic.
- `sidepanel.tsx`: The main UI for the extension.
- `popup.tsx`: A small entry point to open the sidepanel.
