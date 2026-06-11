import fs from 'fs';

const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{document=**} {
      allow read, write: if true;
    }
    match /quizzes/{document=**} {
      allow read, write: if true;
    }
    match /rooms/{document=**} {
      allow read, write: if true;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

fs.writeFileSync('firestore.rules', rules, { encoding: 'utf8' });
console.log('Done');
