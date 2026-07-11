# Phần 0-1: Setup Monorepo & Backend Nền tảng

> Code hoàn chỉnh nằm trong `code/`. File này đi qua **từng đoạn code** và giải thích *vì sao* nó tồn tại — không chỉ nó làm gì.
> Đã kiểm chứng chạy thật: health check, CRUD user, validate Zod (400), trùng dữ liệu (409), 404.

Mục tiêu Phần này: dựng một backend Express **có kiến trúc** để mọi thứ sau này (auth, OAuth, microservice) gắn vào một cách sạch sẽ. Đừng xem nhẹ phần "nền" — 80% việc làm microservice giỏi thực ra là làm backend giỏi.

---

## 0.1 — Vì sao Monorepo? Vì sao pnpm workspaces?

Ta để backend, (sau này) frontend, và nhiều service trong **một repo**. File khai báo:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

Dòng này nói với pnpm: "mọi thư mục con trong `apps/` và `packages/` là một package độc lập". Nhờ đó:

- **Một lệnh `pnpm install`** cài cho tất cả, và các package nội bộ *tham chiếu lẫn nhau* được (ví dụ FE import type từ một package `shared`).
- Chạy lệnh cho đúng một package bằng `--filter`: `pnpm --filter @app/api dev`.

Mỗi package con có `package.json` với `name` riêng — backend của ta tên `@app/api`. Cái tên `@app/...` chỉ là quy ước đặt tên nội bộ (scope) để phân biệt với package trên npm.

> **Vì sao không mỗi thứ một repo (polyrepo)?** Với người học/nhóm nhỏ, monorepo dễ share code và giữ version đồng bộ hơn nhiều. Khi tách microservice ở Phần 6, mỗi service chỉ là thêm một thư mục trong `apps/` — *không đổi cách làm việc*. Đó là lý do ta chọn cấu trúc này ngay từ đầu.

## 0.3 — TypeScript strict: vì sao bật những cờ "khó chịu"

`tsconfig.base.json` là config gốc, mọi app `extends` nó. Vài dòng quan trọng:

```jsonc
"strict": true,                   // bật toàn bộ nhóm kiểm tra nghiêm ngặt
"noUncheckedIndexedAccess": true, // arr[i] có kiểu T | undefined, không phải T
"verbatimModuleSyntax": true,     // ép phân biệt rõ import type vs import giá trị
```

- **`strict`**: đây là lý do *chính* để dùng TypeScript. Nó bắt bạn xử lý `null`/`undefined`, cấm `any` ngầm... → lỗi lộ ra lúc **compile** thay vì lúc user gặp.
- **`noUncheckedIndexedAccess`**: `req.params.id` không còn là `string` mà là `string | undefined`. Nghe phiền, nhưng chính nó ép ta nghĩ "lỡ không có thì sao?". (Ở Phần 2, cờ này bắt được một chỗ ta phải ép kiểu `req.params` cho đúng.)
- **`verbatimModuleSyntax`**: ép viết `import type { X }` khi chỉ dùng X làm kiểu. Quan trọng cho ESM để trình biên dịch biết cái nào xoá được lúc chạy.

> Trải nghiệm thật khi làm tutorial này: strict mode **bắt được 3 lỗi ngay ở bước typecheck** trước khi chạy dòng nào — đó chính là giá trị của nó.

---

## 1.1 & 1.2 — Kiến trúc phân tầng (phần quan trọng nhất Phần này)

Đây là tư duy nền cho *toàn bộ* backend về sau. Một request đi qua **4 tầng**, mỗi tầng đúng **một trách nhiệm**. Lấy module `user` làm ví dụ:

```
HTTP request
   │
   ▼
[Routes]        khai báo URL + gắn middleware        user.routes.ts
   │
   ▼
[Controller]    đọc req / trả res. KHÔNG business    user.controller.ts
   │
   ▼
[Service]       business logic thuần. Không biết HTTP user.service.ts
   │
   ▼
[Repository]    nơi DUY NHẤT chạm DB (Prisma)         user.repository.ts
   │
   ▼
PostgreSQL
```

Đọc theo dòng dữ liệu cho endpoint "tạo user":

**Routes** — chỉ khai báo, không xử lý:
```ts
// user.routes.ts
userRoutes.post(
  "/",
  validate({ body: createUserSchema }), // chặn dữ liệu sai TRƯỚC khi vào trong
  asyncHandler(userController.create),
);
```

**Controller** — chỉ lo HTTP, không có "luật":
```ts
// user.controller.ts
async create(req: Request, res: Response) {
  const user = await userService.create(req.body); // req.body đã sạch nhờ validate
  res.status(201).json(user);
}
```

**Service** — chứa business rule, không biết `req`/`res` là gì:
```ts
// user.service.ts
async create(input: CreateUserInput) {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) throw Conflict("Email đã được sử dụng"); // luật: email không trùng
  return userRepository.create(input);
}
```

**Repository** — chỉ nói chuyện với DB:
```ts
// user.repository.ts
create(data: CreateUserInput) {
  return prisma.user.create({ data, select: publicUserSelect });
}
```

**Vì sao phải tách ra 4 tầng cho mệt?** Vì mỗi tầng thay đổi *độc lập*:

| Đổi cái gì | Chỉ phải sửa |
| --- | --- |
| Express → Fastify | Routes + Controller |
| Prisma → Drizzle | Repository |
| Viết unit test cho business logic | gọi thẳng Service, không cần dựng HTTP server |
| Tái dùng logic cho worker hàng đợi (Phần 5) | gọi lại Service, không qua HTTP |

Chú ý dòng `throw Conflict(...)` trong Service: nó **không** tự trả HTTP 409. Service chỉ *ném* lỗi; việc dịch lỗi thành HTTP là của error handler (mục 1.5). Nhờ vậy Service không dính gì tới HTTP → tái dùng được ở mọi ngữ cảnh. Đây chính là "microservice trá hình": các đơn vị tách bạch, phụ thuộc rõ ràng.

---

## 1.3 — Validation với Zod: một schema, hai công dụng

Xem `user.schema.ts`:

```ts
export const createUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được rỗng").max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

Một schema Zod cho ta **hai thứ cùng lúc** — đây là lý do ta dùng nó thay vì viết `interface` tay:

1. **Kiểm tra lúc chạy**: `createUserSchema.parse(data)` ném lỗi nếu email sai định dạng, tên rỗng...
2. **Kiểu TypeScript**: `z.infer<typeof createUserSchema>` tự suy ra `{ email: string; name: string }`. Sửa schema → type tự cập nhật, không bao giờ lệch.

Middleware `validate` biến schema thành một "cửa kiểm soát" đặt trước controller:

```ts
// middleware/validate.ts
export function validate(schemas: Schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);   // ← gán lại req.body
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(BadRequest("Dữ liệu không hợp lệ", err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
}
```

Hai điểm tinh tế:
- **`req.body = ...parse(...)`** — ta *gán lại* bằng dữ liệu đã parse. Vì sao? Zod không chỉ kiểm tra mà còn **ép kiểu** (ví dụ `z.coerce.number()` biến chuỗi `"20"` từ query string thành số `20`). Controller nhờ đó nhận dữ liệu đã đúng kiểu.
- **`err.flatten().fieldErrors`** — trả về map `{ email: ["..."], name: ["..."] }` để frontend biết *field nào* sai, hiện lỗi ngay dưới ô nhập.

> **Nguyên tắc vàng:** không tin dữ liệu client. Validate ngay ở **biên** (edge) của hệ thống — tức middleware này. Sau cửa này, phần trong yên tâm dữ liệu đã sạch.

---

## 1.4 — PostgreSQL + Prisma

`schema.prisma` là **nguồn sự thật** của database:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("users")   // tên bảng thật trong DB là "users"
}
```

- `@default(cuid())`: id dạng cuid (chuỗi ngắn, khó đoán) thay cho auto-increment — an toàn hơn khi lộ ra URL (không lộ số lượng bản ghi).
- `@unique` trên email: DB tự đảm bảo không trùng. Đây là *lớp bảo vệ thứ hai* sau khi Service đã check (phòng khi hai request tạo cùng lúc — race condition).
- Chạy `prisma migrate dev` sẽ: sinh file SQL migration + áp lên DB + generate ra Prisma Client đã biết kiểu.

Client Prisma được tạo **một lần dùng chung** (singleton) trong `lib/prisma.ts`:

```ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Vì sao gán vào `globalThis`?** Lúc dev, `tsx watch` reload code mỗi lần bạn lưu file. Nếu cứ `new PrismaClient()` mỗi lần reload, sau vài phút bạn có hàng chục connection tới DB → **cạn connection pool**. Cache vào biến global (biến global sống sót qua reload) → luôn tái dùng đúng một client. Chỉ làm ở dev; production khởi động một lần nên không cần.

---

## 1.5 — Xử lý lỗi tập trung: một chỗ, một định dạng

Ta có class lỗi riêng trong `utils/errors.ts`:

```ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly details?: unknown,
  ) { super(message); this.name = "AppError"; }
}
export const NotFound = (msg = "Không tìm thấy") => new AppError(404, msg, "NOT_FOUND");
export const Conflict = (msg = "Dữ liệu đã tồn tại") => new AppError(409, msg, "CONFLICT");
```

Ghi chú cú pháp: `public readonly statusCode` trong constructor là cách viết tắt của TypeScript — nó *tự động* tạo và gán field `this.statusCode`. Đỡ phải khai báo rồi gán lại thủ công.

**Vì sao có class riêng thay vì `throw new Error("...")`?** Để phân biệt **lỗi có chủ đích** (ta biết trước: "email trùng" → 409) với **lỗi bất ngờ** (crash, bug → 500). Error handler dựa vào `instanceof AppError` để xử lý khác nhau:

```ts
// middleware/errorHandler.ts  (rút gọn)
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {                    // (1) lỗi có chủ đích
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
      requestId: req.id,
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) { // (2) lỗi Prisma
    if (err.code === "P2002") return res.status(409).json({ error: { code: "CONFLICT", ... }});
    if (err.code === "P2025") return res.status(404).json({ ... });
  }
  logger.error({ err, requestId: req.id }, "Unhandled error"); // (3) lỗi bất ngờ
  res.status(500).json({ error: { code: "INTERNAL_ERROR",
    message: env.NODE_ENV === "production" ? "Lỗi hệ thống" : err.message } }); // giấu chi tiết ở prod
}
```

- **(2)** dịch mã lỗi Prisma sang HTTP hợp lý: `P2002` = vi phạm unique → 409, `P2025` = không tìm thấy bản ghi → 404. Nhờ đó Service không cần bắt lỗi DB thủ công.
- **(3)** với lỗi không lường trước: **log đầy đủ** để debug, nhưng response chỉ trả thông báo chung ở production — *không lộ stack trace/chi tiết* cho kẻ tấn công.
- Mọi response lỗi có **cùng một hình dạng** `{ error: { code, message, details }, requestId }` → frontend xử lý lỗi thống nhất.

Middleware này phải đặt **cuối cùng** trong `app.ts` (sau mọi route), và có đúng **4 tham số** `(err, req, res, next)` — Express nhận diện error handler qua số tham số là 4.

### `asyncHandler` — mảnh ghép dễ quên

```ts
// utils/asyncHandler.ts
export const asyncHandler = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};
```

**Vấn đề:** Express 4 **không tự bắt** lỗi từ hàm `async`. Nếu controller async ném lỗi (hoặc Promise reject) mà không ai `.catch`, request sẽ **treo** — client chờ mãi. `asyncHandler` bọc controller lại và tự động `.catch(next)` → mọi lỗi async chảy về error handler. Đó là lý do mọi route đều gói `asyncHandler(...)`.

> Express 5 sẽ tự làm việc này, nhưng ta viết tường minh để hiểu bản chất.

---

## 1.6 — Logging & Request ID (chuẩn bị cho microservice)

`middleware/requestId.ts` gán mỗi request một id:

```ts
export function requestId(req, res, next) {
  const incoming = req.header("x-request-id");
  req.id = incoming ?? randomUUID();  // dùng id có sẵn, hoặc sinh mới
  res.setHeader("x-request-id", req.id);
  next();
}
```

**Vì sao `incoming ?? randomUUID()`?** Nếu request đến từ một service khác *đã có* id (header `x-request-id`), ta **giữ nguyên** id đó; nếu không thì sinh mới. Đây là hạt giống cho **distributed tracing** ở Phần 6: một hành động của user đi qua nhiều service nhưng cùng một id → gộp log lại là dựng được toàn cảnh.

Logger dùng **pino** (`lib/logger.ts`): ở dev in màu dễ đọc (pino-pretty), ở production in JSON để máy/hệ thống log tập trung phân tích được. `pino-http` tự log mỗi request kèm chính `req.id` ở trên.

---

## 1.7 — Config an toàn: fail fast

`config/env.ts` validate biến môi trường bằng Zod **ngay khi khởi động**:

```ts
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Biến môi trường không hợp lệ:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);   // ← thoát ngay
}
export const env = parsed.data;
```

**Vì sao `process.exit(1)` ngay?** Đây là triết lý **fail fast**. Nếu thiếu `DATABASE_URL`, thà app **chết ngay lúc khởi động** với thông báo rõ ràng, còn hơn chạy được rồi *nửa tiếng sau* mới sập giữa lúc có user với một lỗi khó hiểu. Ta cũng dùng `env` đã validate ở khắp nơi (`import { env }`) thay vì `process.env.XXX` rải rác — vừa có kiểu, vừa chắc chắn đã kiểm tra.

`z.coerce.number()` cho `PORT`: biến môi trường luôn là **chuỗi**, `coerce` ép `"4000"` thành số `4000`.

---

## Thứ tự middleware trong `app.ts` — vì sao lại xếp như vậy

```ts
app.use(helmet());          // 1. header bảo mật, đặt sớm nhất
app.use(cors({ ... }));     // 2. cho phép frontend gọi
app.use(express.json());    // 3. parse body -> req.body có dữ liệu
app.use(cookieParser());    // 4. parse cookie -> req.cookies
app.use(requestId);         // 5. gán req.id...
app.use(pinoHttp({ ... })); // 6. ...rồi log (phải SAU requestId để log có id)
// ... routes ...
app.use(notFoundHandler);   // áp chót: không route nào khớp -> 404
app.use(errorHandler);      // cuối cùng: bắt mọi lỗi
```

Thứ tự **có ý nghĩa**: middleware chạy tuần tự từ trên xuống. `express.json()` phải trước route thì controller mới có `req.body`. `requestId` phải trước `pinoHttp` thì log mới đính kèm được id. Error handler phải cuối cùng thì mới hứng được lỗi từ mọi thứ phía trên.

---

## Bài tập tự làm

1. Thêm field `age` (tùy chọn) vào `User`: sửa `schema.prisma` → migrate → thêm vào `createUserSchema`. Quan sát type `CreateUserInput` tự cập nhật lan tới controller.
2. Thêm endpoint `GET /api/users/search?email=...` (thêm query schema + repository method).
3. Gọi `DELETE` một user không tồn tại → xem `P2025` được error handler dịch thành 404 ra sao.
4. Gửi `?page=-1` → hiểu vì sao Zod (`.min(1)`) chặn được ngay ở cửa validate.

---

## Tiếp theo → Phần 2: Authentication

Thêm đăng ký/đăng nhập, hash mật khẩu bằng argon2, JWT access + refresh token, lưu refresh token trong Redis có rotation + reuse detection, middleware auth và RBAC.
