# Phần 2: Authentication & Authorization

> Code: `code/apps/api/src/modules/auth/` + `middleware/authenticate.ts` + `middleware/authorize.ts`.
> File này đi qua **từng đoạn code** và giải thích *vì sao*. Đã kiểm chứng chạy thật: đăng ký, đăng nhập, refresh rotation, reuse detection, RBAC, và một lỗ hổng lộ passwordHash đã sửa.

Hai khái niệm dễ lẫn:
- **Authentication (xác thực)** — "bạn là ai?" → đăng nhập, token.
- **Authorization (phân quyền)** — "bạn được làm gì?" → RBAC.

---

## 2.1 — Access token vs Refresh token: vì sao cần cả hai?

| | Access token | Refresh token |
| --- | --- | --- |
| Sống bao lâu | Ngắn (15 phút) | Dài (7 ngày) |
| Gửi khi nào | **Mỗi** API request | Chỉ khi xin access token mới |
| Lưu ở đâu (FE) | Bộ nhớ (memory) | httpOnly cookie |
| Server verify thế nào | Chỉ check chữ ký (stateless) | Check chữ ký **+ Redis** |

Đây là một sự đánh đổi kinh điển, và hiểu nó thì mới thấy vì sao code lại chia làm hai loại token:

- **Access token là *stateless*** — server chỉ cần verify chữ ký JWT là biết token hợp lệ, **không phải hỏi DB/Redis**. Cực nhanh. Nhưng cái giá: một khi đã cấp thì **không thu hồi ngay được** (server không lưu trạng thái của nó). Giải pháp: cho nó **hết hạn thật nhanh** (15 phút). Lỡ bị lộ thì kẻ gian chỉ dùng được tối đa 15 phút.
- **Refresh token bù đắp**: sống lâu (7 ngày) để user không phải đăng nhập lại liên tục. Nhưng vì ta **lưu trạng thái nó trong Redis**, ta **thu hồi được bất cứ lúc nào**. Nó chỉ dùng cho đúng một việc: xin access token mới.

Nói cách khác: access token tối ưu cho *tốc độ*, refresh token tối ưu cho *khả năng kiểm soát*. Dùng cả hai để có cả hai.

---

## 2.2 — Đọc code `token.service.ts` (trái tim của auth)

File này là phần đáng đọc kỹ nhất Phần 2. Đi từng khối.

### Hai loại payload

```ts
export interface AccessPayload {
  sub: string;   // userId (chuẩn JWT gọi subject là "sub")
  email: string;
  role: Role;    // ← nhét role vào token luôn, để RBAC không phải query DB
}
interface RefreshPayload {
  sub: string;   // userId
  jti: string;   // id DUY NHẤT của token này (JWT ID)
  family: string;// id của phiên đăng nhập
}
```

Vì sao access token chứa `role`? Để middleware phân quyền (mục 2.4) đọc thẳng role từ token — **không phải hỏi DB mỗi request**. Đổi lại, nếu bạn đổi role của user, phải chờ access token cũ hết hạn (15m) mới có hiệu lực. Đánh đổi chấp nhận được.

`jti` và `family` là hai mảnh ghép cho rotation/reuse detection — sẽ rõ ngay dưới.

### Ký access token

```ts
export function signAccessToken(user: { id: string; email: string; role: Role }): string {
  const payload: AccessPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,   // "15m"
  } as jwt.SignOptions);
}
```

`jwt.sign` tạo một chuỗi gồm 3 phần `header.payload.signature`. Điểm cốt lõi: **chữ ký** được tạo từ payload + `JWT_ACCESS_SECRET`. Ai không có secret thì **không thể sửa payload** (đổi `role` thành `ADMIN` chẳng hạn) mà giữ chữ ký hợp lệ. Đó là vì sao secret phải bí mật và đủ dài (env schema ép tối thiểu 16 ký tự).

> Lưu ý: payload JWT **không mã hoá**, chỉ ký. Ai cũng đọc được nội dung (thử dán token vào jwt.io). Nên **đừng bao giờ để dữ liệu nhạy cảm** trong payload.

### Refresh token: rotation + reuse detection

Đây là kỹ thuật chống đánh cắp refresh token, chuẩn OAuth 2.0. Ý tưởng:

- **Rotation**: mỗi lần dùng refresh token → cấp token **mới**, huỷ token cũ. Một refresh token chỉ dùng được **đúng một lần**.
- **Reuse detection**: nếu một token cũ (đã bị xoay đi) lại bị dùng → nghĩa là có **hai bên** đang giữ cùng một token → một trong hai là kẻ trộm → **thu hồi cả phiên (family)**.

Ta dùng 2 loại khoá trong Redis (đọc comment trong code):
- `rtfam:{family}` = "1" → đánh dấu **cả phiên** còn hiệu lực.
- `rt:{jti}` = family → đánh dấu **một token cụ thể** chưa bị dùng.

Cấp một refresh token:

```ts
async function issue(userId: string, family: string): Promise<string> {
  const jti = randomUUID();
  const payload: RefreshPayload = { sub: userId, jti, family };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL } as jwt.SignOptions);
  await redis.set(`rt:${jti}`, family, "EX", refreshTtlSec); // ← đánh dấu jti này hợp lệ
  return token;
}
export async function issueRefreshToken(userId: string): Promise<string> {
  const family = randomUUID();                          // đăng nhập = mở phiên MỚI
  await redis.set(`rtfam:${family}`, "1", "EX", refreshTtlSec);
  return issue(userId, family);
}
```

`"EX", refreshTtlSec` đặt **TTL** (thời gian sống) bằng đúng tuổi thọ refresh token → Redis tự dọn rác khi token hết hạn, không cần cron. `refreshTtlSec` tính từ chuỗi `"7d"` qua thư viện `ms`: `Math.floor(ms("7d") / 1000)`.

Bây giờ là hàm quan trọng nhất — **xoay token**:

```ts
export async function rotateRefreshToken(token: string): Promise<{ userId: string; newRefreshToken: string }> {
  const { sub: userId, jti, family } = verifyRefresh(token); // verify chữ ký + hạn

  // 1) Cả phiên còn hiệu lực không?
  const familyOk = await redis.exists(`rtfam:${family}`);
  if (!familyOk) throw Unauthorized("Phiên đã bị thu hồi");

  // 2) Token CỤ THỂ này còn "chưa dùng" không?
  const stored = await redis.get(`rt:${jti}`);
  if (stored === null) {
    // 🚨 REUSE! jti này đã bị xoay đi rồi mà vẫn có người trình ra
    logger.warn({ userId, family }, "Refresh token reuse detected — revoking family");
    await revokeFamily(family);        // thu hồi TOÀN BỘ phiên
    throw Unauthorized("Phát hiện tái sử dụng token — phiên đã bị thu hồi");
  }

  // 3) Hợp lệ -> huỷ token cũ, cấp token mới CÙNG family
  await redis.del(`rt:${jti}`);
  const newRefreshToken = await issue(userId, family);
  return { userId, newRefreshToken };
}
```

Đọc kỹ logic phân biệt hai trường hợp "không hợp lệ":

- **Bước 1** kiểm tra `rtfam:{family}` — nếu phiên đã bị thu hồi (do logout hoặc do reuse trước đó), mọi token của phiên đều chết.
- **Bước 2** là mấu chốt của *reuse detection*. Vì mỗi lần rotate ta `redis.del(rt:{jti_cũ})`, nên một token đã dùng rồi sẽ **không còn** key `rt:{jti}` trong Redis. Nếu ai đó trình ra token mà `rt:{jti}` đã biến mất **nhưng family vẫn còn sống** → chắc chắn token này từng được rotate → giờ lại xuất hiện → có kẻ đang giữ bản sao. Ta không biết bên nào là thật, nên **thu hồi cả phiên** cho an toàn.

Sơ đồ dòng thời gian:

```
Login → family=F, cấp R1        Redis: rtfam:F=1, rt:{jti_R1}=F
  ├─ refresh(R1) ✓ → del rt:{jti_R1}, cấp R2   (R1 chết)
  ├─ refresh(R2) ✓ → del rt:{jti_R2}, cấp R3
  └─ refresh(R1) ✗ → rt:{jti_R1} không còn, nhưng rtfam:F vẫn sống
                   ⇒ REUSE! del rtfam:F ⇒ R2,R3,... chết theo
```

Kết quả kiểm chứng thật:
- Dùng lại token cũ R1 → `401 "Phát hiện tái sử dụng token — phiên đã bị thu hồi"`
- Token mới R2 sau đó cũng → `401 "Phiên đã bị thu hồi"` (cả family revoke)
- Log server: `🚨 Refresh token reuse detected — revoking family`

---

## 2.3 — Lưu token ở đâu (chống XSS & CSRF)

Đây là quyết định bảo mật, không phải chuyện tiện tay. Xem `cookies.ts`:

```ts
res.cookie(REFRESH_COOKIE, token, {
  httpOnly: true,                              // JS KHÔNG đọc được cookie này
  secure: env.NODE_ENV === "production",        // chỉ gửi qua HTTPS ở prod
  sameSite: "lax",                              // giảm CSRF
  path: "/api/auth",                            // cookie chỉ gửi tới route auth
  maxAge: ms(env.REFRESH_TOKEN_TTL),
});
```

Giải thích từng option và *nó chặn tấn công gì*:

- **`httpOnly: true`** → JavaScript của trang **không đọc được** cookie. Nghĩa là dù trang bị dính **XSS** (kẻ gian chèn được script), script đó cũng **không lấy được refresh token**. Đây là lá chắn chính.
- **`secure: true` (ở prod)** → cookie chỉ đi qua HTTPS, chống nghe lén trên mạng. Ở dev để `false` vì `localhost` chạy HTTP.
- **`sameSite: "lax"`** → trình duyệt không gửi cookie này trong hầu hết request chéo trang → giảm **CSRF**. Chọn `lax` (không phải `strict`) để luồng redirect OAuth ở Phần 3 vẫn chạy.
- **`path: "/api/auth"`** → cookie chỉ được đính kèm khi gọi các route `/api/auth/*`. Các API khác không nhận cookie này → giảm bề mặt lộ.

Còn **access token** thì ngược lại: frontend giữ **trong bộ nhớ JS** (biến/state), **không** localStorage.

> **Vì sao không để access token trong localStorage?** Vì localStorage thì JS đọc được → XSS lấy được ngay. Access token trong memory sẽ **mất khi F5** — nhưng không sao: lúc đó frontend gọi `/api/auth/refresh` (cookie tự đính kèm) để lấy access token mới. Đó chính là lý do endpoint `/refresh` tồn tại.

---

## 2.4 — RBAC (phân quyền theo vai trò)

Hai middleware nhỏ, ghép lại thành cơ chế phân quyền. Đầu tiên là **xác thực**:

```ts
// middleware/authenticate.ts
export function authenticate(req, _res, next) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(Unauthorized("Thiếu access token"));
  const token = header.slice("Bearer ".length);
  req.user = verifyAccessToken(token);  // ném Unauthorized nếu sai/hết hạn; gán req.user
  next();
}
```

Nó đọc token từ header `Authorization: Bearer <token>`, verify, rồi **gán `req.user`** cho các middleware/handler sau dùng. Để `req.user` có kiểu, ta *mở rộng* type của Express:

```ts
declare global {
  namespace Express {
    interface Request { user?: AccessPayload; }
  }
}
```

Đây là kỹ thuật "module augmentation" — ta thêm field `user` vào interface `Request` có sẵn của Express, nên `req.user` ở mọi nơi đều có kiểu `AccessPayload | undefined` thay vì lỗi biên dịch.

Tiếp theo là **phân quyền**:

```ts
// middleware/authorize.ts
export function authorize(...allowedRoles: Role[]) {
  return (req, _res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(Forbidden("Bạn không có quyền truy cập tài nguyên này"));
    }
    next();
  };
}
```

Chú ý: `authorize` là một **hàm trả về middleware** (higher-order function). Vì sao? Để ta *truyền tham số* vào lúc khai báo route: `authorize("ADMIN")` hay `authorize("ADMIN", "EDITOR")`. Dùng rest param `...allowedRoles` nên nhận được nhiều role.

Phân biệt hai lỗi: chưa đăng nhập → **401 Unauthorized**; đã đăng nhập nhưng sai vai → **403 Forbidden**. Đây là hai thứ khác nhau và HTTP có mã riêng cho từng cái.

Ghép chuỗi trong `app.ts` — thứ tự middleware là *thứ tự bảo vệ*:

```ts
app.use("/api/users", authenticate, authorize("ADMIN"), userRoutes);
//                     ↑ ai đó?        ↑ có phải admin?    ↑ mới cho vào
```

Test thật: user thường gọi `/api/users` → **403**; admin gọi → **200**.

> Khi hệ thống lớn, chuyển sang **permission-based** (gán quyền chi tiết `user:read`, `user:delete` cho từng role) linh hoạt hơn role cứng. RBAC theo role là điểm khởi đầu tốt.

---

## 2.6 — Hash mật khẩu & chống dò tài khoản

```ts
// modules/auth/password.ts
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}
export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

- Dùng **argon2id** — thuật toán thắng Password Hashing Competition. Nó tốn cả CPU **lẫn RAM** để tính, nên chống brute-force bằng GPU tốt hơn bcrypt.
- Không bao giờ lưu mật khẩu thô. `argon2.hash` tự sinh **salt** ngẫu nhiên và nhúng vào chuỗi kết quả (dạng `$argon2id$v=19$m=...$salt$hash`), nên hai user cùng mật khẩu vẫn ra hash khác nhau.

Trong `auth.service.login`, để ý cách xử lý lỗi:

```ts
const user = await userRepository.findByEmail(input.email);
if (!user || !user.passwordHash) throw Unauthorized("Email hoặc mật khẩu không đúng");
const ok = await verifyPassword(user.passwordHash, input.password);
if (!ok) throw Unauthorized("Email hoặc mật khẩu không đúng");
```

**Cùng một thông báo** cho cả "email không tồn tại" lẫn "sai mật khẩu". Vì sao? Nếu báo "email không tồn tại" riêng, kẻ tấn công thử hàng loạt email sẽ biết **email nào đã đăng ký** ở hệ thống bạn (gọi là *user enumeration*). Thông báo chung chặn điều đó. Check `!user.passwordHash` để xử lý user chỉ đăng nhập qua OAuth (Phần 3) — họ không có mật khẩu.

---

## ⚠️ Lỗ hổng thật mình bắt được khi verify (bài học quan trọng)

Lần chạy đầu, gọi `GET /api/users` (với quyền admin) trả về JSON **có cả `passwordHash`**:

```json
{ "id": "...", "email": "...", "passwordHash": "$argon2id$v=19$m=65536...", "role": "USER" }
```

Dù đã hash, để lộ hash ra ngoài là **lỗ hổng nghiêm trọng**: kẻ tấn công có thể mang về brute-force offline thoải mái, không bị rate-limit.

**Cách sửa** (`user.repository.ts`): định nghĩa rõ "hình dạng công khai" và ép Prisma chỉ trả đúng field đó bằng `select`:

```ts
const publicUserSelect = {
  id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;   // KHÔNG có passwordHash

findById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
}
findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } }); // ← RIÊNG hàm này trả full
}
```

Điểm tinh tế: `findByEmail` **cố ý** giữ nguyên full record (kèm `passwordHash`), vì **login cần** nó để so sánh mật khẩu. Còn mọi hàm phục vụ API trả dữ liệu ra ngoài (`findMany`, `findById`, `create`, `update`) đều dùng `publicUserSelect`.

Từ `satisfies Prisma.UserSelect`: nó bắt TypeScript kiểm tra object của ta đúng là một UserSelect hợp lệ (gõ sai tên field sẽ báo lỗi), nhưng vẫn giữ kiểu cụ thể để Prisma suy ra đúng shape kết quả.

> **Bài học chung:** với mỗi entity, hãy **định nghĩa rõ "public shape"** và chỉ trả đúng nó. Đừng "trả cả object cho tiện". Đây là lỗi cực phổ biến trong dự án thật.

---

## Bài tập tự làm

1. Thêm `POST /api/auth/logout-all` thu hồi **tất cả** phiên của một user (gợi ý: lưu thêm set `user-families:{userId}` chứa mọi family, rồi revoke từng cái).
2. Thêm rate limit cho `/login` bằng Redis (vd 5 lần/phút/IP) — chống brute-force, chuẩn bị cho mục 2.5.
3. Đổi `ACCESS_TOKEN_TTL=10s`, gọi `/me`, đợi 11s rồi gọi lại → quan sát token hết hạn và `authenticate` trả 401.
4. Đọc lại `rotateRefreshToken` rồi vẽ ra giấy điều gì xảy ra nếu **kẻ trộm refresh nhanh hơn** chủ thật — ai bị đá ra?

---

## Tiếp theo → Phần 3: OAuth 2.0 / OIDC

Đăng nhập bằng Google/Keycloak (Authorization Code + PKCE), account linking. Toàn bộ token/RBAC ở Phần 2 được **tái dùng nguyên vẹn** — OAuth chỉ thay phần "xác minh danh tính".
