# STAYONE 決済バックエンド API

STAYONE 民泊サービスの決済に関わるバックエンドシステムです。JPYC による直接送金を用いた予約・決済・手数料・返金フローを完全実装しています。

## 📋 概要

本システムは以下の特徴を持ちます：

- **運営は資金を預からない**: すべての決済はゲスト⇔ホスト間で直接行われます
- **JPYC 決済**: 日本円ステーブルコイン（JPYC）による支払い
- **完全な監査ログ**: 全操作を AuditLog に記録
- **txHash 冪等性**: 同一トランザクションの重複処理を防止
- **ポリシー管理**: 手数料率・返金率を DB で柔軟に管理

## 🏗️ アーキテクチャ

### 技術スタック

- **言語**: TypeScript / Node.js
- **フレームワーク**: Express
- **データベース**: PostgreSQL
- **ORM**: Drizzle ORM
- **認証**: JWT (JSON Web Token)
- **決済**: JPYC (Mock Webhook実装)

### データモデル

| テーブル | 説明 |
|---------|------|
| `users` | ユーザー（guest/host/operator）、ウォレットアドレス保持 |
| `booking_requests` | 予約リクエスト（REQUESTED/APPROVED/REJECTED） |
| `payments` | 事前決済（ゲスト → ホスト） |
| `fee_payments` | 手数料支払い（ホスト → 運営） |
| `refunds` | 返金（ホスト → ゲスト、GUEST_FAULT/HOST_FAULT） |
| `stay_statuses` | 滞在状態（IN_STAY/COMPLETED） |
| `policies` | ポリシー設定（手数料率・返金率など） |
| `audit_logs` | 全操作の監査ログ |

## 🚀 セットアップ

### 環境変数

```bash
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here
PORT=5000
```

### インストール & 起動

```bash
# 依存関係インストール
npm install

# データベースマイグレーション
npm run db:push

# 開発サーバー起動
npm run dev
```

## 📡 API エンドポイント

### 認証 API

#### ユーザー登録

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "guest1",
    "password": "password123",
    "role": "guest",
    "walletAddress": "0xGuestWallet123"
  }'
```

**レスポンス例:**
```json
{
  "user": {
    "id": "uuid-here",
    "username": "guest1",
    "role": "guest",
    "walletAddress": "0xGuestWallet123"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### ログイン

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "guest1",
    "password": "password123"
  }'
```

### 予約フロー

#### 1. 予約リクエスト送信（ゲスト）

```bash
curl -X POST http://localhost:5000/api/booking-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <GUEST_TOKEN>" \
  -d '{
    "hostId": "uuid-of-host",
    "propertyId": "property-001",
    "checkInDate": "2025-01-01T15:00:00Z",
    "checkOutDate": "2025-01-05T11:00:00Z",
    "totalAmount": "50000.00"
  }'
```

**レスポンス例:**
```json
{
  "id": "booking-uuid",
  "guestId": "guest-uuid",
  "hostId": "host-uuid",
  "propertyId": "property-001",
  "totalAmount": "50000.00",
  "status": "REQUESTED",
  "createdAt": "2025-12-17T00:00:00Z"
}
```

#### 2. 予約承認（ホスト）

```bash
curl -X POST http://localhost:5000/api/booking-requests/<BOOKING_ID>/approve \
  -H "Authorization: Bearer <HOST_TOKEN>"
```

#### 3. 予約拒否（ホスト）

```bash
curl -X POST http://localhost:5000/api/booking-requests/<BOOKING_ID>/reject \
  -H "Authorization: Bearer <HOST_TOKEN>"
```

### 事前決済フロー

#### 4. 決済準備（ゲスト）

```bash
curl -X POST http://localhost:5000/api/payments/prepare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <GUEST_TOKEN>" \
  -d '{
    "bookingRequestId": "booking-uuid"
  }'
```

**レスポンス例:**
```json
{
  "paymentId": "payment-uuid",
  "fromWallet": "0xGuestWallet123",
  "toWallet": "0xHostWallet456",
  "amount": "50000.00",
  "message": "JPYCで送金してください。完了後、txHashをWebhookに送信してください。"
}
```

#### 5. 決済完了 Webhook（JPYC → システム）

```bash
curl -X POST http://localhost:5000/api/webhooks/jpyc/payment-completed \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0xabc123transaction",
    "paymentId": "payment-uuid"
  }'
```

### 滞在完了・手数料フロー

#### 6. 滞在完了（ゲスト or ホスト）

```bash
curl -X POST http://localhost:5000/api/stays/<BOOKING_REQUEST_ID>/complete \
  -H "Authorization: Bearer <GUEST_OR_HOST_TOKEN>"
```

**レスポンス例:**
```json
{
  "stayStatus": {
    "id": "stay-uuid",
    "status": "COMPLETED",
    "completedAt": "2025-01-05T11:00:00Z"
  },
  "feePayment": {
    "feePaymentId": "fee-uuid",
    "fromWallet": "0xHostWallet456",
    "toWallet": "0xOperatorWallet",
    "amount": "5000.00",
    "message": "ホストは手数料をJPYCで運営に送金してください"
  }
}
```

#### 7. 手数料支払い完了 Webhook

```bash
curl -X POST http://localhost:5000/api/webhooks/jpyc/fee-completed \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0xdef456fee",
    "feePaymentId": "fee-uuid"
  }'
```

### 返金フロー

#### 8. 返金リクエスト（ゲスト不手際 or ホスト不手際）

```bash
# ゲスト不手際の場合（50%返金）
curl -X POST http://localhost:5000/api/refunds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <GUEST_OR_HOST_TOKEN>" \
  -d '{
    "bookingRequestId": "booking-uuid",
    "faultType": "GUEST_FAULT"
  }'

# ホスト不手際の場合（100%返金）
curl -X POST http://localhost:5000/api/refunds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <GUEST_OR_HOST_TOKEN>" \
  -d '{
    "bookingRequestId": "booking-uuid",
    "faultType": "HOST_FAULT"
  }'
```

**レスポンス例:**
```json
{
  "refundId": "refund-uuid",
  "faultType": "GUEST_FAULT",
  "fromWallet": "0xHostWallet456",
  "toWallet": "0xGuestWallet123",
  "amount": "25000.00",
  "refundRate": "0.5",
  "message": "ホストはJPYCでゲストに返金してください"
}
```

#### 9. 返金完了 Webhook

```bash
curl -X POST http://localhost:5000/api/webhooks/jpyc/refund-completed \
  -H "Content-Type: application/json" \
  -d '{
    "txHash": "0xghi789refund",
    "refundId": "refund-uuid"
  }'
```

### ポリシー管理（運営のみ）

#### ポリシー作成・更新

```bash
curl -X POST http://localhost:5000/api/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATOR_TOKEN>" \
  -d '{
    "name": "fee_policy",
    "config": {
      "feeRate": 0.1
    }
  }'

curl -X POST http://localhost:5000/api/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATOR_TOKEN>" \
  -d '{
    "name": "refund_policy",
    "config": {
      "GUEST_FAULT": 0.5,
      "HOST_FAULT": 1.0
    }
  }'
```

### 監査ログ取得（運営のみ）

```bash
curl -X GET http://localhost:5000/api/audit-logs/payment/<PAYMENT_ID> \
  -H "Authorization: Bearer <OPERATOR_TOKEN>"
```

### 予約リスト取得

```bash
# ゲストの予約一覧
curl -X GET http://localhost:5000/api/booking-requests \
  -H "Authorization: Bearer <GUEST_TOKEN>"

# ホストの予約一覧
curl -X GET http://localhost:5000/api/booking-requests \
  -H "Authorization: Bearer <HOST_TOKEN>"
```

## 🔄 決済フロー図

本システムは添付されたシーケンス図に完全準拠しています：

### 1. 事前決済フロー
1. ゲストが予約リクエスト送信（`POST /api/booking-requests`）
2. ホストが承認（`POST /api/booking-requests/:id/approve`）
3. ゲストが決済準備（`POST /api/payments/prepare`）
4. システムが支払先ウォレット情報を返却
5. ゲストが JPYC で直接ホストに送金
6. JPYC Webhook でシステムに通知（`POST /api/webhooks/jpyc/payment-completed`）
7. ステータスが `IN_STAY` に遷移

### 2. 滞在完了・手数料フロー
1. ゲスト/ホストが滞在完了通知（`POST /api/stays/:id/complete`）
2. システムが手数料を計算し、ホストに支払先情報を返却
3. ホストが JPYC で運営に手数料を送金
4. JPYC Webhook でシステムに通知（`POST /api/webhooks/jpyc/fee-completed`）

### 3. 返金フロー（ゲスト不手際）
1. ゲスト/ホストが返金リクエスト送信（`POST /api/refunds`, `faultType: GUEST_FAULT`）
2. システムが返金率 50% で計算
3. ホストが JPYC でゲストに返金
4. JPYC Webhook でシステムに通知（`POST /api/webhooks/jpyc/refund-completed`）

### 4. 返金フロー（ホスト不手際）
1. ゲスト/ホストが返金リクエスト送信（`POST /api/refunds`, `faultType: HOST_FAULT`）
2. システムが返金率 100% で計算
3. ホストが JPYC でゲストに全額返金
4. JPYC Webhook でシステムに通知

## 🛡️ セキュリティ

### JWT 認証
すべての保護されたエンドポイントは `Authorization: Bearer <TOKEN>` ヘッダーが必要です。

### ロールベース認証
- **guest**: 予約作成、決済、滞在完了
- **host**: 予約承認/拒否、滞在完了
- **operator**: ポリシー管理、監査ログ閲覧

### txHash 冪等性
同一 `txHash` での Webhook は AuditLog でチェックされ、重複処理を防止します。

## 📊 監査ログ

すべてのステータス変更・決済操作は `audit_logs` テーブルに記録されます：

- **entityType**: 操作対象（`booking_request`, `payment`, `refund` など）
- **entityId**: 対象のID
- **action**: 操作内容（`CREATED`, `APPROVED`, `COMPLETED` など）
- **userId**: 操作者（Webhook の場合は null）
- **previousState**: 変更前の状態
- **newState**: 変更後の状態
- **txHash**: トランザクションハッシュ（該当する場合）
- **metadata**: 追加メタデータ

## 🧪 テストシナリオ例

### 完全フロー（予約→決済→滞在→手数料）

```bash
# 1. ユーザー登録
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"guest1","password":"pass123","role":"guest","walletAddress":"0xGuest1"}'

curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"host1","password":"pass123","role":"host","walletAddress":"0xHost1"}'

curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"operator","password":"pass123","role":"operator","walletAddress":"0xOperator"}'

# 2. ポリシー設定（運営）
curl -X POST http://localhost:5000/api/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATOR_TOKEN>" \
  -d '{"name":"fee_policy","config":{"feeRate":0.1}}'

curl -X POST http://localhost:5000/api/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATOR_TOKEN>" \
  -d '{"name":"refund_policy","config":{"GUEST_FAULT":0.5,"HOST_FAULT":1.0}}'

# 3. 予約作成（ゲスト）
BOOKING_RESPONSE=$(curl -X POST http://localhost:5000/api/booking-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <GUEST_TOKEN>" \
  -d '{"hostId":"<HOST_ID>","propertyId":"prop-001","checkInDate":"2025-01-01T15:00:00Z","checkOutDate":"2025-01-05T11:00:00Z","totalAmount":"50000"}')

BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.id')

# 4. 予約承認（ホスト）
curl -X POST http://localhost:5000/api/booking-requests/$BOOKING_ID/approve \
  -H "Authorization: Bearer <HOST_TOKEN>"

# 5. 決済準備（ゲスト）
curl -X POST http://localhost:5000/api/payments/prepare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <GUEST_TOKEN>" \
  -d "{\"bookingRequestId\":\"$BOOKING_ID\"}"

# 6. 決済完了 Webhook
curl -X POST http://localhost:5000/api/webhooks/jpyc/payment-completed \
  -H "Content-Type: application/json" \
  -d "{\"txHash\":\"0xpayment123\",\"paymentId\":\"$BOOKING_ID\"}"

# 7. 滞在完了（ゲスト）
curl -X POST http://localhost:5000/api/stays/$BOOKING_ID/complete \
  -H "Authorization: Bearer <GUEST_TOKEN>"

# 8. 手数料支払い完了 Webhook
curl -X POST http://localhost:5000/api/webhooks/jpyc/fee-completed \
  -H "Content-Type: application/json" \
  -d "{\"txHash\":\"0xfee123\",\"feePaymentId\":\"$BOOKING_ID\"}"
```

## 📝 OpenAPI / Swagger 仕様

### API 仕様概要

```yaml
openapi: 3.0.0
info:
  title: STAYONE Payment Backend API
  version: 1.0.0
  description: JPYC決済を用いた民泊予約・決済システム

servers:
  - url: http://localhost:5000
    description: Development server

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        username:
          type: string
        role:
          type: string
          enum: [guest, host, operator]
        walletAddress:
          type: string

    BookingRequest:
      type: object
      properties:
        id:
          type: string
          format: uuid
        guestId:
          type: string
          format: uuid
        hostId:
          type: string
          format: uuid
        propertyId:
          type: string
        checkInDate:
          type: string
          format: date-time
        checkOutDate:
          type: string
          format: date-time
        totalAmount:
          type: string
        status:
          type: string
          enum: [REQUESTED, APPROVED, REJECTED]

    Payment:
      type: object
      properties:
        id:
          type: string
          format: uuid
        bookingRequestId:
          type: string
          format: uuid
        fromWallet:
          type: string
        toWallet:
          type: string
        amount:
          type: string
        txHash:
          type: string
          nullable: true
        status:
          type: string
          enum: [PENDING, COMPLETED]

paths:
  /api/auth/register:
    post:
      summary: ユーザー登録
      tags: [Authentication]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password, role, walletAddress]
              properties:
                username:
                  type: string
                password:
                  type: string
                role:
                  type: string
                  enum: [guest, host, operator]
                walletAddress:
                  type: string
      responses:
        '201':
          description: ユーザー登録成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  token:
                    type: string

  /api/auth/login:
    post:
      summary: ログイン
      tags: [Authentication]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username:
                  type: string
                password:
                  type: string
      responses:
        '200':
          description: ログイン成功

  /api/booking-requests:
    post:
      summary: 予約リクエスト作成
      tags: [Booking]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [hostId, propertyId, checkInDate, checkOutDate, totalAmount]
      responses:
        '201':
          description: 予約リクエスト作成成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookingRequest'
    get:
      summary: 予約リスト取得
      tags: [Booking]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: 予約リスト取得成功

  /api/booking-requests/{id}/approve:
    post:
      summary: 予約承認
      tags: [Booking]
      security:
        - BearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 承認成功

  /api/booking-requests/{id}/reject:
    post:
      summary: 予約拒否
      tags: [Booking]
      security:
        - BearerAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 拒否成功

  /api/payments/prepare:
    post:
      summary: 決済準備
      tags: [Payment]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [bookingRequestId]
              properties:
                bookingRequestId:
                  type: string
      responses:
        '201':
          description: 決済準備成功

  /api/webhooks/jpyc/payment-completed:
    post:
      summary: 決済完了 Webhook
      tags: [Webhooks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [txHash, paymentId]
              properties:
                txHash:
                  type: string
                paymentId:
                  type: string
      responses:
        '200':
          description: Webhook処理成功

  /api/stays/{bookingRequestId}/complete:
    post:
      summary: 滞在完了
      tags: [Stay]
      security:
        - BearerAuth: []
      parameters:
        - in: path
          name: bookingRequestId
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 滞在完了成功

  /api/refunds:
    post:
      summary: 返金リクエスト
      tags: [Refund]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [bookingRequestId, faultType]
              properties:
                bookingRequestId:
                  type: string
                faultType:
                  type: string
                  enum: [GUEST_FAULT, HOST_FAULT]
      responses:
        '201':
          description: 返金リクエスト作成成功

  /api/webhooks/jpyc/refund-completed:
    post:
      summary: 返金完了 Webhook
      tags: [Webhooks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [txHash, refundId]
              properties:
                txHash:
                  type: string
                refundId:
                  type: string
      responses:
        '200':
          description: Webhook処理成功

  /api/policies:
    post:
      summary: ポリシー作成・更新
      tags: [Policy]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, config]
              properties:
                name:
                  type: string
                config:
                  type: object
      responses:
        '201':
          description: ポリシー作成成功

  /api/audit-logs/{entityType}/{entityId}:
    get:
      summary: 監査ログ取得
      tags: [Audit]
      security:
        - BearerAuth: []
      parameters:
        - in: path
          name: entityType
          required: true
          schema:
            type: string
        - in: path
          name: entityId
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 監査ログ取得成功
```

## 🔗 参考リンク

- **JPYC 公式サイト**: https://jpyc.co.jp/
- **Drizzle ORM**: https://orm.drizzle.team/
- **Express**: https://expressjs.com/

## 📄 ライセンス

MIT License

## ✨ 開発者向けメモ

- 本実装はシーケンス図に完全準拠しています
- JPYC Webhook は Mock 実装（実際のブロックチェーン接続なし）
- すべてのステータス変更は AuditLog に記録されます
- txHash による冪等性チェックで重複処理を防止しています
