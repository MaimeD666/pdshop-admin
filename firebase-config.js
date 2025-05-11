const firebaseConfig = {
  apiKey: "AIzaSyCDjXMxt7ppjd4rgEdQvdkXMYqz2wOLz3Y",
  authDomain: "pdshop-8f846.firebaseapp.com",
  projectId: "pdshop-8f846",
  storageBucket: "pdshop-8f846.firebasestorage.app",
  messagingSenderId: "673934870613",
  appId: "1:673934870613:web:bfa384823780a5e8a1acdc"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();