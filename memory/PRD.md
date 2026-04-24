# Tortellino — Product Requirements Document

## Overview
An interactive Duolingo-style Italian learning app with lessons, gamified XP/level progression, daily streak, and a teacher admin panel to create/edit lessons with rich exercise types (multiple choice, true/false, right/wrong, open answer, word reordering, audio, video). Designed with accessibility for DSA students (clear typography, high contrast, generous spacing). Mascot: the Tortellino.

## Users
- **Students**: register/login, complete lessons, earn XP, keep streak, save questions.
- **Teacher (admin)**: email `lorenzopasqualot@gmail.com` seeded as admin. Creates/edits/deletes lessons and exercises through in-app admin panel. Media (audio/video/image) uploaded as base64.

## Core Features
- Auth: JWT-based email/password (Bearer token stored in AsyncStorage).
- Homepage: gamified vertical path, lesson nodes (locked/current/completed), tortellino mascot on the active node, XP bar, level badge, 7-day streak strip with flame and checkmarks.
- Lesson player: progress bar, descrizione espandibile, save bookmark, 7 exercise types, immediate feedback, confetti on correct, +5 XP per first-time correct answer.
- Completion screen: tortellino, coriandoli, recap (XP, speed, best combo, correct/total), "Ricevi XP e torna alla homepage" + "Ripassa" (on errors).
- Saved questions section with lesson context.
- Profile: level, XP, streak, admin panel shortcut, logout.
- Admin panel: list/create/edit/delete lessons, manage exercises (any of 7 types), upload media.

## XP & Levels
- +5 XP per correct answer (first time only; no XP for already-solved questions).
- Lv 1→2 = 50 XP, Lv 2→3 = 100 XP, each next level +100 XP.

## Streak
- Completing at least one lesson per day increments streak; broken if day skipped.
- Weekly strip shows Mon–Sun with check for each day with activity in current ISO week.

## API
All endpoints under `/api`. Auth via `Authorization: Bearer <token>`.
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /lessons`, `GET /lessons/{id}`, `POST /lessons` (admin), `PUT /lessons/{id}` (admin), `DELETE /lessons/{id}` (admin)
- `POST /progress/answer`, `POST /progress/complete-lesson`
- `GET /saved`, `POST /saved`, `DELETE /saved?lesson_id=&exercise_id=`

## Stack
- Frontend: Expo Router (React Native 0.81), AsyncStorage, Reanimated (confetti), expo-av (audio/video), expo-document-picker + FileSystem (base64 upload).
- Backend: FastAPI, motor (MongoDB), bcrypt, PyJWT.
- DB: MongoDB collections `users`, `lessons`.

## Next Action Items
- Teacher logs in with seeded admin credentials and creates first lesson.
- Students register and start learning.
