# 배포 방법 (Node.js가 설치된 PC에서 진행)

이 저장소를 만든 환경(지금 저와 작업 중인 이 PC)에는 Node.js가 없어서 여기서는 직접 배포할 수 없습니다.
Node.js가 설치된 아무 PC에서 아래 순서대로 하시면 됩니다.

## 1. 사전 준비
1. **Firebase 요금제를 Blaze(종량제)로 전환** — Cloud Functions는 무료 Spark 플랜에서 동작하지 않습니다.
   (사용량이 적으면 실제 청구금액은 거의 없습니다 — 월 무료 할당량 안에서 대부분 해결됩니다)
2. **알리고(https://smartsms.aliyo.com) 가입** → 발신번호 사전등록(본인인증 필요) → API KEY/USER ID 발급

## 2. 배포 명령어
```bash
npm install -g firebase-tools
firebase login
cd papori-mall
firebase init functions   # 이미 있는 functions 폴더 그대로 사용, 기존 파일 덮어쓰지 않기
firebase functions:secrets:set ALIGO_API_KEY
firebase functions:secrets:set ALIGO_USER_ID
firebase functions:secrets:set ALIGO_SENDER
firebase functions:secrets:set ADMIN_PHONE
cd functions && npm install && cd ..
firebase deploy --only functions
```

## 3. 배포 후 확인
- Firebase 콘솔 → Functions 메뉴에서 `onOrderStatusChange`, `onNewQuoteRequest` 두 함수가 보이면 성공
- admin.html에서 주문 상태를 바꿔보고 문자가 오는지 테스트

## 참고
- 견적요청 이메일 자동발송도 필요하시면 같은 방식(Cloud Function + 이메일 API, 예: Resend/SendGrid)으로 추가할 수 있습니다 — 알려주시면 코드 추가해드리겠습니다.
