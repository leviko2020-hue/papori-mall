// PAPORI Firebase 연동 공용 스크립트 (Firebase v9 모듈형 SDK, CDN 사용)
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---- 회원가입 ----
// memberType: "personal" | "corp"
export async function paporiSignUp({ email, password, name, memberType, companyName }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // 등급(grade) 필드는 지금은 전부 "일반"으로 고정, 나중에 등급별 혜택 붙일 때 이 필드만 바꾸면 됨
  await setDoc(doc(db, "members", cred.user.uid), {
    email, name, memberType, companyName: companyName || null,
    grade: "일반",
    approved: true, // 승인 절차 없이 즉시 이용 가능
    createdAt: serverTimestamp()
  });
  return cred.user;
}

// ---- 로그인 ----
export async function paporiLogin({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function paporiLogout() {
  return signOut(auth);
}

export function paporiOnAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---- 견적요청 저장 ----
// items: [{ name, model, qty, note }]
// customer: { companyName, contact, email, message }
export async function paporiSubmitQuote({ items, customer }) {
  const ref = await addDoc(collection(db, "quoteRequests"), {
    items,
    customer,
    status: "답변대기",
    validUntil: "발행일로부터 7일",
    createdAt: serverTimestamp()
  });
  return ref.id;
}
