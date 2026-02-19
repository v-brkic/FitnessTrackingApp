# Fitness App (React + Firebase + Capacitor)

A simple fitness tracking app built with **React** (Create React App), **Firebase** (Auth + Firestore) and **Capacitor** (Android wrapper).

## Screenshots

<div align="center">
  <img src="assets/screenshot-1.png" width="260" alt="Screenshot 1" />
  <img src="assets/screenshot-2.png" width="260" alt="Screenshot 2" />
  <img src="assets/screenshot-3.png" width="260" alt="Screenshot 3" />
</div>

## Features
- Email/password authentication (Firebase Auth)
- Workout plan by days + mark today’s workout as done
- Weekly progress summary on the Home screen
- Local reminders (Capacitor Local Notifications)
- Progress photos (stored in Firestore as metadata; image storage strategy can be plugged in)

## Tech stack
- **Frontend:** React 18, React Router
- **Mobile wrapper:** Capacitor 7 (Android)
- **Backend:** Firebase Authentication, Cloud Firestore
- **Hosting/CI:** Firebase Hosting + GitHub Actions

## Getting started (local)

### Prerequisites
- Node.js **18+** and npm
- A Firebase project (Firestore + Auth enabled)

### 1) Configure environment variables
This project reads Firebase Web App config from environment variables.

1. Copy `.env.example` to `.env`
2. Fill in values from your Firebase Console → Project settings → Your apps → Web app config

### 2) Install & run
```bash
npm ci
npm start
```

### 3) Build
```bash
npm run build
```

## Firebase setup
1. Create a project in Firebase Console
2. Add a **Web App** and copy the config values into `.env`
3. Enable **Authentication → Email/Password**
4. Create a **Cloud Firestore** database

### Example Firestore security rules
Adjust rules to your data model. This is a starting point restricting access to the authenticated user:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /plans/{dayKey}/exercises/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /sessions/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## Android (Capacitor)
If you haven’t added the platform yet:
```bash
npx cap add android
```
Then:
```bash
npm run cap:sync:android
npm run cap:open:android
```

### Notifications permission
Ensure your Android manifest contains:
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Deployment (Firebase Hosting + GitHub Actions)
This repo includes GitHub Actions workflows that:
- build the React app
- deploy to Firebase Hosting on pushes to `main`
- deploy a preview channel on pull requests

### Required GitHub repository secrets
Set these in **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

**Firebase deploy (service account):**
- `FIREBASE_SERVICE_ACCOUNT_FITENSSAPP` → the full JSON of a Firebase service account key with Hosting deploy permissions

**Build-time env vars (Firebase Web config):**
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`

> Note: Firebase Web config values are not “private keys” by themselves, but keeping them in secrets can reduce accidental copying and makes it easy to swap environments.

## Scripts
- `npm start` – run dev server
- `npm run build` – create production build
- `npm run cap:sync:android` – build + sync Capacitor Android
- `npm run cap:open:android` – open Android project in Android Studio
