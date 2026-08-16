// PAPORI Firebase Cloud Functions
// ⚠️ 이 폴더는 아직 배포되지 않았습니다. 배포하려면 이 리포지토리를 Node.js가 설치된
// PC에서 열어 아래 절차를 따라주세요 (README-DEPLOY.md 참고).
//
// 기능 1) 주문(orders) 문서의 status 필드가 바뀌면 고객에게 자동으로 SMS 발송
// 기능 2) 견적요청(quoteRequests) 신규 접수 시 관리자에게 SMS로 알림
//
// SMS 발송은 알리고(Aligo, https://smartsms.aliyo.com) API를 사용합니다.
// - 가입 후 발급되는 API KEY / USER ID / 발신번호(사전 등록 필요)를
//   Firebase Functions 환경변수로 설정해야 합니다 (배포 가이드 참고).

const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ALIGO_API_KEY = defineSecret("ALIGO_API_KEY");
const ALIGO_USER_ID = defineSecret("ALIGO_USER_ID");
const ALIGO_SENDER = defineSecret("ALIGO_SENDER"); // 알리고에 사전 등록된 발신번호
const ADMIN_PHONE = defineSecret("ADMIN_PHONE");   // 견적문의 알림 받을 관리자 번호

const ORDER_STATUS_MESSAGE = {
  "입금대기": (o) => `[PAPORI] 주문이 접수되었습니다. 무통장입금 확인 후 발송 처리됩니다. 주문금액: ${(o.totalAmount || 0).toLocaleString()}원`,
  "결제완료": (o) => `[PAPORI] 결제가 완료되었습니다. 2~3일 내 발송 예정입니다.`,
  "배송중": (o) => `[PAPORI] 상품이 발송되었습니다.`,
  "배송완료": (o) => `[PAPORI] 배송이 완료되었습니다. 이용해주셔서 감사합니다.`,
};

async function sendSms({ apiKey, userId, sender, receiver, msg }) {
  const body = new URLSearchParams({
    key: apiKey,
    user_id: userId,
    sender,
    receiver,
    msg,
  });
  const res = await fetch("https://apis.aligo.in/send/", { method: "POST", body });
  const data = await res.json();
  if (data.result_code !== "1") {
    logger.error("Aligo SMS 발송 실패", data);
  }
  return data;
}

// 주문 상태가 바뀌면 고객에게 SMS 발송
exports.onOrderStatusChange = onDocumentUpdated(
  { document: "orders/{orderId}", secrets: [ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER] },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.status === after.status) return; // 상태 변경이 아니면 무시

    const contact = after.customer && after.customer.contact;
    if (!contact) return;

    const buildMsg = ORDER_STATUS_MESSAGE[after.status];
    if (!buildMsg) return; // 매핑 안 된 상태값은 발송하지 않음

    await sendSms({
      apiKey: ALIGO_API_KEY.value(),
      userId: ALIGO_USER_ID.value(),
      sender: ALIGO_SENDER.value(),
      receiver: contact.replace(/[^0-9]/g, ""),
      msg: buildMsg(after),
    });
  }
);

// 새 견적요청이 접수되면 관리자에게 SMS 알림
exports.onNewQuoteRequest = onDocumentCreated(
  { document: "quoteRequests/{quoteId}", secrets: [ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER, ADMIN_PHONE] },
  async (event) => {
    const data = event.data.data();
    const company = (data.customer && data.customer.companyName) || "비회원";
    await sendSms({
      apiKey: ALIGO_API_KEY.value(),
      userId: ALIGO_USER_ID.value(),
      sender: ALIGO_SENDER.value(),
      receiver: ADMIN_PHONE.value(),
      msg: `[PAPORI] 새 견적요청 접수: ${company} (관리자 화면에서 확인)`,
    });
  }
);
