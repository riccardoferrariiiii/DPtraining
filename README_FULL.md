# Cosa fare passo per passo (0€)

## 1) Crea Firebase
1. Vai su Firebase Console → Create project
2. Authentication → Sign-in method → Email/Password → Enable
3. Firestore Database → Create database (Production mode ok)
4. Firestore → Rules → incolla `firebase/firestore.rules` → Publish

## 2) Crea la Web App su Firebase (per prendere le chiavi)
Project settings → General → Your apps → Add app → Web
Copia i valori nel file `.env.local` (vedi step 3).

## 3) Avvio in locale
Dentro `web/`:
```bash
npm install
cp .env.example .env.local
# incolla i valori Firebase dentro .env.local
npm run dev
```
Apri http://localhost:3000

## 4) Primo coach (tu)
1. Vai su /login → Crea account con la tua mail
2. Firestore → collection `users` → apri il doc del tuo UID
3. imposta `role` = "coach"

## 5) Gli atleti
Gli atleti fanno /login → Crea account.
Tu li vedi in Coach → “Gestisci atleti”:
- imposti scadenza (YYYY-MM-DD)
- apri “Programmazione” e crei settimane e workout

## 6) Deploy GRATIS su Firebase Hosting
Installa Firebase CLI:
```bash
npm i -g firebase-tools
firebase login
```

Build/export del sito:
```bash
cd web
npm run build
npm run export
```

Init hosting:
```bash
cd ../firebase
firebase init hosting
```
- Public directory: `../web/out`
- Configure as single-page app: YES

Deploy:
```bash
firebase deploy --only hosting
```

Ti esce un link tipo `https://tuoprogetto.web.app`

## 7) Notifiche push (coach + atleta)
### 7.1 Web app (Vercel)
Nel file `web/.env.local` aggiungi anche:
```bash
NEXT_PUBLIC_FIREBASE_VAPID_KEY=... # Web Push certificate key pair (public key)
```

La service worker `firebase-messaging-sw.js` viene generata in automatico da `npm run dev/build`.

### 7.2 Backend notifiche (Firebase Functions)
Da `firebase/functions`:
```bash
npm install
```

Poi deploy da `firebase/`:
```bash
firebase deploy --only functions
```

Eventi coperti:
- atleta invia risultato -> push al coach
- coach risponde a risultato -> push all'atleta
- coach assegna settimana -> push all'atleta
- promemoria scadenza abbonamento (7 giorni prima) -> push all'atleta (job giornaliero)
