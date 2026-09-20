# Deployment Without Firebase Billing

This setup does not use Firebase Cloud Functions, so Firebase Blaze billing is not required.

```text
React frontend       Firebase Hosting
Authentication       Firebase Authentication
Database             Firestore
Express API          Render Web Service
AI evaluation        Gemini, called only by Express
```

## 1. Prepare Firebase

In Firebase Console for project `blindcode-2f539`:

1. Enable **Authentication -> Sign-in method -> Email/Password**.
2. Create the Firestore database.
3. Keep the project on the Spark plan.

The Firestore rules are in [firestore.rules](firestore.rules).

## 2. Prepare a new Firebase service account

Create a new service-account key in Firebase Console under **Project settings -> Service accounts -> Generate new private key**.

Do not upload the JSON file to Render. Copy these values into Render environment variables:

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

The old key was exposed and should be revoked.

## 3. Deploy the Express API to Render

1. Open Render and sign in with GitHub.
2. Create **New -> Web Service**.
3. Select this repository.
4. Render can use [render.yaml](render.yaml), or enter these values manually:

```text
Root directory: server
Build command: npm ci && npm run build
Start command: npm start
Health check path: /api/health
```

Add these environment variables in Render:

```env
FIREBASE_PROJECT_ID=blindcode-2f539
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n
GEMINI_API_KEY=your-new-gemini-key
GEMINI_MODEL=gemini-2.5-flash
CLIENT_ORIGIN=https://blindcode-2f539.web.app
```

The Firebase values for this project are:

```env
FIREBASE_PROJECT_ID=blindcode-2f539
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@blindcode-2f539.iam.gserviceaccount.com
```

Keep `FIREBASE_PRIVATE_KEY` and `GEMINI_API_KEY` secret. The local server can use `GOOGLE_APPLICATION_CREDENTIALS=../blindcode-2f539-firebase-adminsdk-fbsvc-4495f49514.json` instead of copying the private key into `.env`.

After deployment, copy the Render URL, for example:

```text
https://blindcode-api.onrender.com
```

Test the API:

```bash
curl https://blindcode-api.onrender.com/api/health
```

Expected response:

```json
{"status":"ok","service":"blindcode-server"}
```

## 4. Connect React to Render

Edit `client/.env`:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Replace the placeholder with the actual Render URL. Do not put `GEMINI_API_KEY` in this file.

## 5. Deploy React and Firestore rules

From the project root:

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting,firestore --project blindcode-2f539
```

Open:

```text
https://blindcode-2f539.web.app
```

## 6. Create an admin user

Users authenticate through Firebase Authentication. Admin access requires a custom claim:

```ts
await adminAuth.setCustomUserClaims("FIREBASE_UID", { role: "admin" });
```

After assigning the claim, the admin must sign out and sign in again. The admin user will then open the event control screen.

## Local development

Terminal 1:

```bash
cd server
npm run dev
```

Terminal 2:

```bash
cd client
npm run dev
```

Vite proxies local `/api` requests to `http://localhost:3001`.
