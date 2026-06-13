import { initializeApp }                from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import { getAuth, setPersistence,
         browserLocalPersistence }     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
import { getFirestore,
         enableIndexedDbPersistence }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

const firebaseConfig = {
  apiKey:            'AIzaSyDM2Z2KWnp6YSa0LAppodJ4lnA3RJyeNes',
  authDomain:        'sizo-80446.firebaseapp.com',
  projectId:         'sizo-80446',
  storageBucket:     'sizo-80446.firebasestorage.app',
  messagingSenderId: '742969715144',
  appId:             '1:742969715144:web:de2bd9f91054a677cf38fd',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
// Storage y Functions se activan cuando el plan Blaze esté disponible

setPersistence(auth, browserLocalPersistence).catch(console.error)

enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Offline: múltiples pestañas abiertas')
  else if (err.code === 'unimplemented')  console.warn('Offline: browser no compatible')
})
