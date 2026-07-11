# Phần 3: OAuth 2.0 & OpenID Connect

> Code: `code/apps/api/src/modules/auth/oauth/` + `code/keycloak/`.
> Đã kiểm chứng chạy thật: trọn luồng Authorization Code + PKCE với **Keycloak** thật trong Docker, account linking idempotent, CSRF state.

Ở Phần 2, người dùng đăng nhập bằng email + mật khẩu do *chính hệ thống ta* quản lý. Phần này ta cho phép họ đăng nhập bằng **tài khoản của bên thứ ba** (Google, hoặc một Auth Server như Keycloak). Điều hay ở đây: ta sẽ không viết code riêng cho Google rồi lại viết code riêng cho Keycloak — nhờ chuẩn **OpenID Connect (OIDC)**, cùng một đoạn code chạy được với *mọi* provider tuân theo chuẩn.

---

## 3.1 — Các nhân vật trong OAuth 2.0

Trước khi đọc code, cần nắm 4 vai trò. Hãy hình dung cảnh đưa hộ chiếu ở sân bay:

| Vai trò OAuth | Là ai trong hệ thống ta | Ví dụ đời thường |
| --- | --- | --- |
| **Resource Owner** | Người dùng cuối | Bạn — chủ nhân danh tính |
| **Client** | Backend Express của ta (`app-api`) | Quầy check-in muốn xác minh bạn |
| **Authorization Server** | Google / Keycloak | Cơ quan cấp hộ chiếu |
| **Resource Server** | Nơi giữ dữ liệu (ở đây là endpoint `userinfo`) | Kho dữ liệu công dân |

Ý tưởng cốt lõi: **Client không bao giờ thấy mật khẩu của user**. User nhập mật khẩu *trên trang của Authorization Server*, rồi server đó cấp cho Client một "vé" (token) để Client biết "ừ, đúng là người này".

## 3.2 — Vì sao dùng Authorization Code + PKCE (chứ không phải flow khác)

OAuth có nhiều "flow". Với web/SPA ngày nay, chuẩn khuyến nghị là **Authorization Code + PKCE**. Toàn bộ luồng gồm 5 bước:

```
 (Trình duyệt)                (API của ta)              (Keycloak/Google)
      │                            │                            │
      │  1. bấm "Login with X"     │                            │
      │ ─────────────────────────► │                            │
      │                            │  tạo state + PKCE, lưu lại  │
      │  2. 302 redirect ──────────┼──────────────────────────► │
      │                            │        (kèm code_challenge) │
      │                                                          │
      │  3. user đăng nhập trên trang provider ─────────────────►│
      │                                                          │
      │  4. 302 về ?code=...&state=...  ◄────────────────────────│
      │ ─────────────────────────► │                            │
      │                            │  5. đổi code+verifier ─────►│  (server-to-server)
      │                            │     ◄──────── access_token  │
      │                            │  gọi /userinfo ────────────►│
      │                            │     ◄──────── {sub,email}   │
      │  6. set cookie + redirect  │                            │
      │ ◄───────────────────────── │                            │
```

Hai khái niệm bảo mật quan trọng nhất ở đây là **state** và **PKCE** — ta sẽ thấy chúng trong code ngay dưới.

---

## 3.3 — Đọc code: `providers.ts` (biết một provider là gì)

Mỗi provider khác nhau ở đúng 3 thứ: client id/secret, "issuer" (địa chỉ gốc), và scope. Nên ta mô tả provider bằng một interface đơn giản:

```ts
export interface ProviderConfig {
  name: string;
  issuer: string;    // gốc để "discovery" (tìm các endpoint)
  clientId: string;
  clientSecret: string;
  scope: string;     // "openid email profile"
}
```

- **`issuer`** là mấu chốt. Nhờ OIDC, chỉ cần biết issuer là ta tự tìm được mọi endpoint (xem `discover()` bên dưới) — *không hardcode URL cho từng provider*.
- **`scope`** khai báo ta xin những thông tin gì. `openid` là bắt buộc để kích hoạt OIDC; `email profile` để lấy email và tên.

Hàm `redirectUri(provider)` dựng địa chỉ mà provider sẽ gọi ngược lại:

```ts
export function redirectUri(provider: string): string {
  return `${env.OAUTH_REDIRECT_BASE}/api/auth/oauth/${provider}/callback`;
}
```

> ⚠️ **Lỗi #1 mọi người hay gặp:** `redirect_uri` gửi cho provider phải **trùng từng ký tự** với giá trị đã khai báo trong dashboard của provider (hoặc trong `realm-export.json` của Keycloak). Sai một dấu `/` là provider từ chối. Vì thế ta tính nó từ một hàm duy nhất để dùng nhất quán ở cả bước 2 và bước 5.

`getProvider(name)` trả về `null` (thay vì ném lỗi) nếu provider chưa cấu hình env. Lý do: bạn có thể chỉ muốn bật Keycloak mà chưa có credential Google — app vẫn chạy, chỉ route `/oauth/google/login` báo 404 gọn gàng.

---

## 3.4 — Đọc code: `oidc.ts` (các bước kỹ thuật)

Đây là file nhiều "vì sao" nhất. Đọc từng hàm.

### `discover(issuer)` — tự tìm endpoint

```ts
const url = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;
const res = await fetch(url);
const doc = await res.json(); // { authorization_endpoint, token_endpoint, userinfo_endpoint }
discoveryCache.set(issuer, doc);
```

Chuẩn OIDC quy định mọi provider phải công bố một file JSON tại `{issuer}/.well-known/openid-configuration` liệt kê tất cả endpoint. Ta fetch **một lần** rồi cache vào `Map` (`discoveryCache`), vì các endpoint này gần như không bao giờ đổi — cache để khỏi gọi mạng ở mỗi request.

- `issuer.replace(/\/$/, "")` xoá dấu `/` thừa ở cuối để tránh tạo ra `//.well-known` (một lỗi nối chuỗi kinh điển).
- Biến `discoveryCache` để *ngoài* hàm (module-level) nên nó sống suốt vòng đời process → đó chính là cách cache đơn giản nhất trong Node.

### `createPkce()` — trái tim của bảo mật PKCE

```ts
export function createPkce() {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}
```

**Vấn đề PKCE giải quyết:** ở bước 4, authorization `code` bay qua trình duyệt (trên URL). Nếu code này bị lộ (qua lịch sử duyệt web, log proxy, extension...), kẻ gian có thể mang nó đi đổi lấy token.

**Cách PKCE chặn:**
- `codeVerifier`: một chuỗi bí mật ngẫu nhiên, ta **giữ ở server**, không gửi đi ở bước 2.
- `codeChallenge = SHA256(codeVerifier)`: bản băm, cái này *mới* gửi cho provider ở bước 2.
- Ở bước 5, khi đổi code lấy token, ta chìa ra `codeVerifier` gốc. Provider tự băm lại và so với `codeChallenge` đã nhận. Khớp thì mới cấp token.

Kẻ gian trộm được `code` nhưng **không có `codeVerifier`** (nó nằm ở server ta) → không đổi được token. Băm một chiều nên biết challenge cũng không suy ngược ra verifier.

`base64url()` dùng `.toString("base64url")` để ra chuỗi chỉ gồm `[A-Za-z0-9-_]` — an toàn khi nhét vào URL (base64 thường có `+ / =` gây hỏng URL).

### `createState()` — chống CSRF

```ts
export function createState(): string {
  return base64url(randomBytes(16));
}
```

`state` là một chuỗi ngẫu nhiên ta sinh ở bước 1 và bắt provider trả lại nguyên vẹn ở bước 4. Ta sẽ kiểm tra nó ở `oauth.controller.ts`. Ý nghĩa: chỉ những callback *do chính luồng login của ta khởi tạo* mới có state hợp lệ → chặn kẻ gian dụ trình duyệt bạn gọi thẳng vào callback (tấn công CSRF). Sẽ nói kỹ ở mục 3.5.

### `buildAuthorizationUrl(...)` — dựng link redirect

```ts
url.search = new URLSearchParams({
  response_type: "code",              // ta muốn nhận về CODE
  client_id: provider.clientId,
  redirect_uri: opts.redirectUri,
  scope: provider.scope,
  state: opts.state,
  code_challenge: opts.codeChallenge,
  code_challenge_method: "S256",      // báo provider: challenge là SHA256
}).toString();
```

Dùng `URLSearchParams` thay vì tự nối `?a=b&c=d` vì nó **tự encode** giá trị đúng chuẩn (dấu cách trong scope, ký tự đặc biệt...). Đây là chi tiết nhỏ nhưng tự nối tay là nguồn bug bất tận.

### `exchangeCodeForToken(...)` — bước server-to-server

```ts
const body = new URLSearchParams({
  grant_type: "authorization_code",
  code: opts.code,
  redirect_uri: opts.redirectUri,   // phải GIỐNG HỆT bước 2
  client_id: provider.clientId,
  client_secret: provider.clientSecret,
  code_verifier: opts.codeVerifier, // "chìa khoá" PKCE
});
const res = await fetch(opts.tokenEndpoint, { method: "POST", headers: {...}, body });
```

Bước này chạy **từ backend ta tới provider**, không qua trình duyệt — nên ở đây mới an toàn để gửi `client_secret`. Đây cũng là lý do ta chọn "confidential client": secret không bao giờ lộ ra frontend.

> ⚠️ **Lỗi #2:** `redirect_uri` ở bước này phải trùng khít với bước 2, nếu không provider báo `invalid_grant`. Ta tránh bằng cách gọi chung `redirectUri(provider)`.

### `fetchUserInfo(...)` — lấy danh tính

```ts
const res = await fetch(userinfoEndpoint, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
return await res.json(); // { sub, email, email_verified, name }
```

Có 2 cách lấy thông tin user sau khi có token: (a) giải mã `id_token` (một JWT provider trả kèm), hoặc (b) gọi endpoint `/userinfo` với access token. Ta chọn (b) cho **đơn giản và luôn đúng**.

- Trường **`sub`** (subject) là id của user *bên provider*, không bao giờ đổi kể cả khi họ đổi email → ta dùng nó làm khoá liên kết (xem 3.6).

> 📝 Production nghiêm ngặt hơn nên **verify chữ ký của `id_token`** bằng khoá công khai của provider (JWKS, thư viện `jose`). Cách userinfo của ta an toàn nhờ HTTPS + access token, đủ tốt để học và cho phần lớn ứng dụng; nâng cấp verify id_token là bài tập mở rộng.

---

## 3.5 — Đọc code: `oauth.controller.ts` (ráp mọi thứ + chống CSRF)

Controller có 2 hàm ứng với 2 endpoint.

### `login` — bước 1 & 2

```ts
const { codeVerifier, codeChallenge } = createPkce();
const state = createState();

await redis.set(
  stateKey(state),
  JSON.stringify({ codeVerifier, provider: providerName }),
  "EX", 600,           // sống 10 phút
);

const url = buildAuthorizationUrl({ ... });
res.redirect(url);
```

Điểm cần hiểu: **`codeVerifier` phải sống sót giữa bước 1 và bước 5**, nhưng hai bước đó là *hai request HTTP khác nhau* (thậm chí user có thể đăng nhập ở tab khác). HTTP vốn stateless → ta phải lưu tạm ở đâu đó. Ta chọn **Redis**, khoá theo `state`:

- `stateKey(state)` = `"oauth-state:" + state` → mỗi lần login là một "vé giữ chỗ" riêng.
- Giá trị lưu cả `codeVerifier` (để bước 5 dùng) và `provider` (để chống lẫn provider).
- `"EX", 600`: tự hết hạn sau 10 phút. Nếu user bỏ dở giữa chừng, "rác" tự dọn — không cần cron.

> **Vì sao không lưu `codeVerifier` vào cookie?** Cũng được, nhưng dùng Redis thì server toàn quyền kiểm soát, không phụ thuộc trình duyệt gửi cookie đúng lúc redirect chéo miền. Với các flow OAuth, lưu server-side theo `state` là cách rất phổ biến.

### `callback` — bước 4 & 5 (và lá chắn CSRF)

```ts
const raw = await redis.get(stateKey(state));
if (!raw) throw BadRequest("State không hợp lệ hoặc đã hết hạn (nghi CSRF)");
await redis.del(stateKey(state));   // dùng 1 lần rồi bỏ
```

Đây là **kiểm tra CSRF quan trọng nhất**. Suy nghĩ qua kịch bản tấn công:

> Kẻ gian tạo sẵn một `code` của *tài khoản hắn*, rồi lừa bạn bấm vào link `.../callback?code=<code-của-hắn>`. Nếu ta cứ thế xử lý, bạn sẽ vô tình bị "đăng nhập vào tài khoản của kẻ gian" và mọi dữ liệu bạn nhập sau đó rơi vào tay hắn.

Vì `state` do *ta* sinh ngẫu nhiên và lưu trong Redis, link của kẻ gian sẽ không có `state` khớp với bản trong Redis của bạn → `redis.get` trả `null` → ta từ chối. `redis.del` ngay sau đó đảm bảo mỗi state **chỉ dùng được một lần** (chống replay).

Kiểm tra thêm `storedProvider === providerName` để chống trường hợp state của provider này bị dùng cho callback của provider khác.

Phần còn lại chỉ là gọi các hàm ở `oidc.ts` theo đúng thứ tự: `discover` → `exchangeCodeForToken` → `fetchUserInfo` → `oauthService.loginWithOAuth`.

Cuối cùng:

```ts
setRefreshCookie(res, refreshToken);
res.redirect(`${env.FRONTEND_URL}/auth/callback?login=success`);
```

**Vì sao lại redirect về frontend chứ không trả JSON?** Vì trình duyệt đang ở giữa một chuỗi redirect (đây là điều hướng cả trang, không phải fetch AJAX). Ta đặt refresh token vào httpOnly cookie rồi đưa user về một trang frontend; trang đó gọi `POST /api/auth/refresh` (cookie tự đính kèm) để lấy access token. **Nhờ vậy access token không bao giờ xuất hiện trên URL** (URL bị lưu vào lịch sử, log server...). Đây là chi tiết bảo mật quan trọng.

---

## 3.6 — Đọc code: `oauth.service.ts` (Account Linking)

Provider chỉ nói cho ta "đây là user có `sub=X`, `email=Y`". Việc của service là quy nó về **một User nội bộ**. Có đúng 3 tình huống, xử lý theo thứ tự:

```ts
// (1) Đã từng đăng nhập bằng tài khoản OAuth này -> chính là login.
let user = await oauthRepository.findUserByOAuthAccount(provider, info.sub);

if (!user) {
  const existing = await oauthRepository.findUserByEmail(info.email);
  if (existing) {
    // (2) Email đã có user nội bộ -> LIÊN KẾT tài khoản OAuth vào user đó.
    if (info.email_verified === false) throw new AppError(403, "Email chưa xác minh...");
    await oauthRepository.linkAccount(existing.id, provider, info.sub);
    user = existing;
  } else {
    // (3) Hoàn toàn mới -> tạo user + liên kết trong 1 transaction.
    user = await oauthRepository.createUserWithAccount({ ... });
  }
}
```

- **(1)** dùng `sub` (không phải email) làm khoá, vì `sub` không đổi. Đây là đường "login lặp lại" — đã kiểm chứng: login lần 2 **không** tạo user trùng.
- **(2)** là *account linking*: bạn đã có tài khoản email/mật khẩu từ Phần 2, giờ đăng nhập Google cùng email → ta gắn Google vào tài khoản cũ thay vì tạo tài khoản thứ hai.

> ⚠️ **Lỗ hổng chiếm tài khoản (rất quan trọng):** dòng `if (info.email_verified === false) throw ...`. Nếu ta auto-link chỉ dựa trên email mà không kiểm tra provider đã *verify* email đó chưa, kẻ gian có thể tạo tài khoản Google với **email của bạn** (chưa verify) rồi đăng nhập → bị gắn vào tài khoản nội bộ của bạn → chiếm tài khoản. Vì thế chỉ auto-link khi `email_verified` là true. (User test Keycloak của ta đặt `emailVerified: true` nên link được.)

Điểm mấu chốt của cả kiến trúc: **OAuth chỉ dùng để *xác minh danh tính*.** Sau khi biết đây là user nào, ta cấp **access + refresh token của chính hệ thống ta** (tái dùng nguyên `token.service.ts` của Phần 2). Nghĩa là toàn bộ phần còn lại của app (RBAC, refresh rotation, `/me`...) không cần biết user đăng nhập bằng cách nào — rất sạch.

`createUserWithAccount` trong repository dùng **nested write** của Prisma để tạo `User` và `OAuthAccount` trong **một transaction** (all-or-nothing): không có chuyện tạo được user nhưng lỗi khi tạo liên kết, để lại dữ liệu nửa vời.

---

## 3.7 — Keycloak: dựng Auth Server bằng Docker

Google cần đăng ký app trên Google Cloud (mất công, cần domain thật để hoàn chỉnh). Để *học và test được ngay trên máy*, ta dùng **Keycloak** — một Auth Server/OIDC provider mã nguồn mở, chạy trong Docker.

Trong `docker-compose.yml`:

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:26.0
  command: ["start-dev", "--import-realm"]
  environment:
    KC_BOOTSTRAP_ADMIN_USERNAME: admin
    KC_BOOTSTRAP_ADMIN_PASSWORD: admin
  ports: ["8081:8080"]
  volumes: ["./keycloak:/opt/keycloak/data/import"]
```

- `start-dev` chạy chế độ dev (không cần HTTPS, DB nhẹ) — chỉ dùng để học.
- `--import-realm` + volume `./keycloak`: khi khởi động, Keycloak tự nạp `realm-export.json`. Nhờ vậy bạn **không phải click chuột trong admin console** để tạo client/user — mọi thứ dựng sẵn bằng code (Infrastructure as Code).

Trong `keycloak/realm-export.json` có sẵn:
- **realm `app`**: một "không gian" chứa user/client riêng.
- **client `app-api`**: chính là Client của ta. `secret: "keycloak-client-secret"`, `redirectUris` trỏ về callback của ta, `pkce.code.challenge.method: S256` bắt buộc PKCE.
- **user `tester`** / `password123`, `emailVerified: true`.

Khớp với env của backend:
```
KEYCLOAK_ISSUER=http://localhost:8081/realms/app
KEYCLOAK_CLIENT_ID=app-api
KEYCLOAK_CLIENT_SECRET=keycloak-client-secret
```

---

## 3.8 — Kết quả kiểm chứng (chạy thật, không mô phỏng)

Mình đã chạy trọn luồng bằng script headless (giả lập trình duyệt) với Keycloak thật:

```
1) GET /oauth/keycloak/login  → 302 sang Keycloak
   ✓ URL có code_challenge (PKCE), state (CSRF), response_type=code
2) Mở trang login Keycloak, lấy form action                ✓
3) POST tester/password123    → Keycloak 302 về callback kèm ?code   ✓
4) GET callback trên API      → tạo user + set refresh cookie        ✓
5) POST /auth/refresh (cookie)→ access token (231 ký tự)             ✓
6) GET /auth/me               → {email: "tester@example.com", role: "USER"}  ✓
7) Login lần 2                → vẫn 1 user, 1 oauth_account (không trùng)     ✓
```

## 3.9 — Cách bật đăng nhập Google (khi bạn có domain thật)

Code đã sẵn sàng cho Google (cùng luồng OIDC). Bạn chỉ cần:
1. Vào Google Cloud Console → tạo OAuth 2.0 Client ID (loại Web).
2. Thêm Authorized redirect URI: `https://api.tenban.com/api/auth/oauth/google/callback` (khớp `redirectUri`).
3. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` vào `.env`.
4. Frontend trỏ nút "Login with Google" tới `/api/auth/oauth/google/login`.

> Google bắt redirect URI phải là HTTPS (trừ `localhost`) — đây là một trong những lý do Phần 9 ta gán domain thật + HTTPS.

---

## Bài tập tự làm

1. Thêm provider GitHub: chỉ cần thêm một nhánh trong `getProvider()` (GitHub không hoàn toàn OIDC nên userinfo hơi khác — thử xử lý).
2. Verify chữ ký `id_token` bằng `jose` + JWKS thay cho gọi `/userinfo`.
3. Thêm nút "Liên kết Google" cho user *đang đăng nhập* (account linking chủ động, không qua đăng nhập).
4. Thử xoá `emailVerified: true` của user Keycloak → xem service chặn auto-link như thế nào.

---

## Tiếp theo → Phần 4: Frontend React

Dựng frontend Vite + React + Tailwind, React Router (protected route), TanStack Query, Zustand — và nối vào toàn bộ auth (kể cả nút đăng nhập Keycloak/Google) ta vừa xây.
```
