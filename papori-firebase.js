// PAPORI Firebase 연동 공용 스크립트 (Firebase v9 모듈형 SDK, CDN 사용)
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider, deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, doc, setDoc,
  getDoc, getDocs, query, orderBy, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 관리자 화면(admin.html) 접근을 허용할 이메일 목록.
// 실제 접근 제어는 Firestore 보안규칙에서 걸어야 하며, 이건 화면단 게이트일 뿐입니다.
export const PAPORI_ADMIN_EMAILS = ["paporimomo@gmail.com"];

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

// ---- 비밀번호 찾기(재설정 메일 발송) ----
// Firebase가 해당 이메일로 재설정 링크를 직접 보내줍니다(자체 서버 불필요).
export function paporiSendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

// ---- 회원 탈퇴 ----
// 보안상 최근 로그인이 필요해, 탈퇴 직전 비밀번호를 다시 확인(재인증)한 뒤 계정을 완전히 삭제합니다.
// 완전 삭제이므로 탈퇴 후 같은 이메일로 즉시 재가입할 수 있습니다.
export async function paporiDeleteAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const cred = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, cred);
  await deleteDoc(doc(db, "members", user.uid)).catch(() => {}); // 회원정보 문서도 함께 삭제(실패해도 탈퇴는 진행)
  await deleteUser(user);
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

// ---- 관리자: 견적문의 목록 조회 ----
export async function paporiGetQuotes() {
  const snap = await getDocs(query(collection(db, "quoteRequests"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- 주문 저장 ----
// items: [{ name, price, qty }], customer: {...}, payMethod, taxInvoice(bool)
export async function paporiSubmitOrder({ items, customer, payMethod, taxInvoice, totalAmount }) {
  const ref = await addDoc(collection(db, "orders"), {
    items,
    customer,
    payMethod,
    taxInvoice: !!taxInvoice,
    totalAmount,
    status: payMethod === "무통장입금" ? "입금대기" : "결제완료",
    createdAt: serverTimestamp()
  });
  return ref.id;
}

// ---- 관리자: 주문 목록 조회 ----
export async function paporiGetOrders() {
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- 상품 가격/재고 오버라이드 ----
// 상품의 기본 가격/스펙은 각 product-detail-*.html에 그대로 있고, 관리자가 여기서
// 가격을 바꾸거나 재고를 0으로 두면(품절) 해당 값이 기본값을 덮어씁니다.
// productId는 product-detail-*.html 파일명에서 .html을 뺀 값 (예: "product-detail-m11w")
export async function paporiGetProductOverrides() {
  const snap = await getDocs(collection(db, "productOverrides"));
  const map = {};
  snap.forEach(d => { map[d.id] = d.data(); });
  return map;
}
export async function paporiGetProductOverride(productId) {
  const snap = await getDoc(doc(db, "productOverrides", productId));
  return snap.exists() ? snap.data() : null;
}
// data: { price?: number, stock?: number }  — price/stock 중 넘긴 필드만 갱신(merge)
export async function paporiSaveProductOverride(productId, data) {
  await setDoc(doc(db, "productOverrides", productId), {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// ---- 상품 이미지 업로드 (Firebase Storage) ----
// productId 폴더 아래에 원본 파일명(+타임스탬프)으로 저장하고, 공개 다운로드 URL을 돌려줍니다.
export async function paporiUploadProductImage(productId, file) {
  var safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var path = 'product-images/' + productId + '/' + safeName;
  var ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  var url = await getDownloadURL(ref);
  return { url: url, path: path };
}
export async function paporiDeleteProductImage(path) {
  try { await deleteObject(storageRef(storage, path)); } catch (e) { /* 이미 삭제된 경우 등은 무시 */ }
}

// ---- 신규 상품(관리자가 직접 등록한 상품) ----
// customProducts/{id} 문서 하나가 상품 하나. id는 "custom-" 접두어 + 타임스탬프로 자동 생성됩니다.
// 필드: name, model, category(카테고리 페이지 매칭용, 예: "한전 보수용 자재"), brand, badge,
//       price(숫자 또는 null=가격문의), images: [{url, path}], description, specRows: [{label, value}], hidden(bool)
export function paporiNewProductId() {
  return 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}
export async function paporiGetCustomProducts() {
  var snap = await getDocs(query(collection(db, "customProducts"), orderBy("createdAt", "desc")));
  return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
}
export async function paporiGetCustomProductsByCategory(category) {
  var snap = await getDocs(query(collection(db, "customProducts"), where("category", "==", category)));
  return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (p) { return !p.hidden; });
}
export async function paporiGetCustomProduct(id) {
  var snap = await getDoc(doc(db, "customProducts", id));
  return snap.exists() ? Object.assign({ id: id }, snap.data()) : null;
}
export async function paporiSaveCustomProduct(id, data) {
  await setDoc(doc(db, "customProducts", id), Object.assign({}, data, { updatedAt: serverTimestamp() }), { merge: true });
}
export async function paporiCreateCustomProduct(data) {
  var id = paporiNewProductId();
  await setDoc(doc(db, "customProducts", id), Object.assign({}, data, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  return id;
}
export async function paporiDeleteCustomProduct(id) {
  await deleteDoc(doc(db, "customProducts", id));
}

// ---- 사이트 기본정보 설정 (상호/대표자/주소 등, 푸터에 실시간 반영) ----
export async function paporiGetSiteConfig() {
  const snap = await getDoc(doc(db, "siteConfig", "main"));
  return snap.exists() ? snap.data() : null;
}
export async function paporiSaveSiteConfig(data) {
  await setDoc(doc(db, "siteConfig", "main"), {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
