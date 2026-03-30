# Deploying Dibakar AI to Render (Free Plan)

This app is optimized for **Render's Free Tier (Web Service)**.

### 1. Create a New Web Service on Render
- **Type:** Web Service
- **Environment:** Node
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

### 2. Add Environment Variables
In the Render Dashboard, go to **Environment** and add:
- `GROQ_API_KEY`: Your Groq API key
- `SERPER_API_KEY`: Your Serper.dev API key
- `GMAIL_USER`: Your Gmail address
- `GMAIL_PASS`: Your Gmail App Password
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID
- `NODE_ENV`: `production`

### 3. Optimization Details
- **Memory:** The server is compiled to JS using `esbuild` to save RAM (Render Free Plan has 512MB limit).
- **Port:** The app automatically uses the `PORT` assigned by Render.
- **Static Assets:** The server serves the pre-built frontend from the `dist` folder.

### 4. Troubleshooting
- **Main File Not Found:** Ensure you've selected **Web Service** (not Static Site) and that the **Start Command** is `npm start`.
- **Firebase Errors:** Make sure you've uploaded your `firebase-applet-config.json` or set the environment variables correctly.
