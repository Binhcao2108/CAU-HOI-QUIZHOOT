# Kahoot Clone

A full-stack realtime Kahoot clone built with React, TailwindCSS, TypeScript, and Firebase.

## Features

- **Host Dashboard**: Create game rooms with custom questions and time limits.
- **Player Interface**: Players join instantly using a 6-digit PIN and a Nickname (No sign-up required!).
- **Real-Time Sync**: Questions, answers, and the timer sync instantly using Firebase Firestore listeners.
- **Scoring**: Points computed securely using response time and accuracy.
- **Leaderboards**: Displays top players between rounds and at the end of the game with a final podium.

## Firebase Setup

This app uses Firebase Firestore and Authentication.

1. Go to Firebase Console and create a new project.
2. Enable Firestore Database.
3. Enable Firebase Authentication (Google provider and Anonymous Auth MUST be enabled!).
4. Add a Web App in Firebase Project Settings to find your Firebase Configuration.
5. Create a `firebase-applet-config.json` inside the project root matching your credentials:
```json
{
  "apiKey": "AIza...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "firestoreDatabaseId": "(default)"
}
```

IMPORTANT: You MUST enable **Anonymous provision** in Firebase Authentication settings for players to join without an account!

## Firestore Rules

Deploy the `firestore.rules` included in the root folder to Firebase to secure your app! You can do this from the Firebase CLI:
`firebase deploy --only firestore:rules`

## Local Development

```bash
npm install
npm run dev
```

## Vercel Deployment

This project comes ready for deployment using Vercel. Because the SPA relies on `react-router` for client-side routing, a `vercel.json` rewrite rule has been bundled.

1. Fork or push this repository to GitHub.
2. In Vercel, attach the repository.
3. Vercel will auto-detect Vite. Build command is `npm run build` and output directory is `dist`.
4. Click deploy.
