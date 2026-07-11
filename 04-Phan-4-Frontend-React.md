# Phần 4: Frontend React

> Code: `code/apps/web/`. Đi qua từng file và giải thích *vì sao*.
> Đã kiểm chứng **chạy thật trong trình duyệt**: login → dashboard → users (RBAC) → F5 giữ phiên (silent refresh) → giữ đúng deep-link. Bắt và sửa **2 bug thật** trong lúc test (xem cuối bài).

Frontend này nối vào toàn bộ backend đã xây (Phần 2 + 3). Điểm khó nhất không phải là vẽ UI, mà là **quản lý phiên đăng nhập ở client** cho đúng và an toàn — đó là trọng tâm của bài.

---

## 4.0 — Bức tranh state: Server state vs Client state

Nguyên tắc nền của frontend hiện đại: **phân biệt hai loại state** và dùng công cụ khác nhau cho mỗi loại.

| | Server state | Client state |
| --- | --- | --- |
| Là gì | Dữ liệu *thuộc về server*, ta chỉ mượn về hiển thị | Trạng thái *của riêng UI/phiên* |
| Ví dụ | danh sách user, profile | access token, theme, modal đang mở |
| Vấn đề | cache, refetch, đồng bộ, stale | chỉ cần đọc/ghi nhanh |
| Công cụ | **TanStack Query** | **Zustand** |

Sai lầm phổ biến là nhét dữ liệu server vào Redux/Zustand rồi tự viết loading/error/refetch bằng tay. TanStack Query sinh ra để lo hết phần đó. Còn access token thì đúng là client state → Zustand. Ta theo đúng ranh giới này.

---

## 4.1 — Cấu hình: Vite + Tailwind + Proxy

`vite.config.ts` có một chi tiết rất quan trọng — **proxy**:

```ts
server: {
  proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } },
},
```

**Vì sao cần?** Frontend chạy ở `localhost:5173`, backend ở `localhost:4000` — hai origin khác nhau. Nếu gọi thẳng `http://localhost:4000/api/...` ta sẽ dính **CORS** và rắc rối cookie cross-site. Với proxy, frontend gọi đường dẫn **tương đối** `/api/...` → trình duyệt thấy đó là cùng origin `localhost:5173` → Vite âm thầm chuyển tiếp sang backend. Không CORS, cookie là first-party.

Bonus: cách này **giống production** (Phần 9) — frontend và API sẽ nằm sau cùng một domain qua reverse proxy. Nên `api.ts` để `baseURL: ""` (rỗng) và không hardcode host nào → deploy đâu chạy đó.

Tailwind v4 thì gọn: chỉ cần plugin `@tailwindcss/vite` và một dòng `@import "tailwindcss";` trong `index.css` — không cần file `tailwind.config.js`.

---

## 4.2 — Auth store (Zustand): vì sao token nằm trong bộ nhớ

`stores/auth.store.ts`:

```ts
interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  setAuth: (token, user) => void;       // đăng nhập xong: có cả token + user
  setAccessToken: (token) => void;      // chỉ đổi token, KHÔNG đổi status
  clear: () => void;                    // đăng xuất / hết phiên
}
```

Ba điều cần hiểu:

1. **`accessToken` chỉ ở trong RAM**, không persist localStorage. Nhắc lại từ Phần 2: localStorage bị XSS đọc được. Mất token khi F5 là *chủ ý* — ta khôi phục bằng silent refresh (mục 4.5).

2. **`status` là "nguồn sự thật" cho việc điều hướng.** Nó có 3 trạng thái, đặc biệt có `"loading"` — trạng thái "chưa biết đã đăng nhập hay chưa" lúc app vừa mở. Thiếu nó thì app sẽ *nháy* qua trang login một nhịp trước khi kịp khôi phục phiên.

3. **`setAccessToken` cố tình KHÔNG đổi `status`.** Đây là chi tiết mà một bug thật đã dạy cho ta (xem mục cuối). Chỉ `setAuth`/`clear` mới được lật `status`. Nhờ đó không bao giờ rơi vào trạng thái nửa vời "authenticated nhưng user=null".

> Vì sao Zustand? Nó tối giản: `useAuthStore((s) => s.user)` trong component, hoặc `useAuthStore.getState().accessToken` ngoài React (như trong axios interceptor). Không cần Provider bọc, không boilerplate như Redux.

---

## 4.3 — `api.ts`: axios interceptor tự refresh (phần phức tạp nhất)

Đây là "bộ não" kết nối frontend với backend. File làm hai việc.

### (1) Request interceptor — tự gắn token

```ts
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Mỗi request tự lấy access token *mới nhất* từ store gắn vào header. Component không bao giờ phải tự đính token → quên là hết lỗi. Chú ý dùng `getState()` (không phải hook) vì đây là code ngoài React.

### (2) Response interceptor — refresh khi 401

Ý tưởng: access token hết hạn (15m) → request trả **401** → thay vì báo lỗi cho user, ta *âm thầm* gọi `/refresh` lấy token mới rồi **thử lại request gốc**. User không hề hay biết.

Vấn đề khó: khi token vừa hết hạn, có thể **nhiều request cùng nhận 401 một lúc** (ví dụ trang tải song song 3 API). Ta chỉ muốn gọi `/refresh` **một lần**, các request kia xếp hàng chờ token mới. Cơ chế:

```ts
let isRefreshing = false;
let waiters: Array<(token: string) => void> = [];

// ... trong interceptor, khi gặp 401:
if (isRefreshing) {
  // đã có người đang refresh -> xếp hàng, xong thì thử lại với token mới
  return new Promise((resolve) => {
    waiters.push((token) => {
      original.headers.Authorization = `Bearer ${token}`;
      resolve(api(original));
    });
  });
}
isRefreshing = true;
try {
  const { data } = await api.post("/api/auth/refresh");
  useAuthStore.getState().setAccessToken(data.accessToken);
  waiters.forEach((cb) => cb(data.accessToken));  // đánh thức cả hàng chờ
  waiters = [];
  original.headers.Authorization = `Bearer ${data.accessToken}`;
  return api(original);
} catch {
  useAuthStore.getState().clear();               // refresh cũng chết -> logout
} finally {
  isRefreshing = false;
}
```

Các "van an toàn" cần có, mỗi cái chặn một cách hỏng:

- **`original._retry`**: đánh dấu request đã thử lại rồi. Nếu thử lại vẫn 401 → dừng, tránh **lặp vô hạn**.
- **Kiểm tra `original.url.includes("/api/auth/refresh")`**: nếu chính `/refresh` trả 401 nghĩa là refresh token cũng hết hạn → hết cứu → `clear()` (đăng xuất). Không được thử refresh cái refresh.
- **`isRefreshing` + `waiters`**: gom nhiều 401 đồng thời về **một** lần gọi `/refresh`. Quan trọng vì `/refresh` có **rotation** (Phần 2) — gọi hai lần song song sẽ khiến lần sau bị coi là *reuse* và thu hồi cả phiên!

> Đây chính là lý do backend và frontend phải được thiết kế *ăn khớp*: rotation ở server buộc client phải nghiêm túc chỉ-refresh-một-lần.

---

## 4.4 — Hooks: dùng TanStack Query đúng cách

**Mutation** cho hành động thay đổi (`auth.hooks.ts`):

```ts
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => { setAuth(data.accessToken, data.user); navigate("/dashboard"); },
  });
}
```

`useMutation` cho ta miễn phí: `login.isPending` (đang gửi → disable nút), `login.isError` (hiện thông báo lỗi). Không phải tự quản `useState` cho loading/error.

`useLogout` dùng `onSettled` (chạy dù thành công hay lỗi): dù server có lỗi, phía client **vẫn phải quên mình đi** — `clear()` + `queryClient.clear()` để xoá sạch cache server-state của user cũ (nếu không, user sau đăng nhập có thể thấy dữ liệu user trước).

**Query** cho dữ liệu server (`users.hooks.ts`):

```ts
export function useUsers(page = 1) {
  return useQuery({
    queryKey: ["users", page],   // "địa chỉ" trong cache
    queryFn: () => usersApi.list(page),
  });
}
```

`queryKey: ["users", page]` là khóa cache. Có `page` trong khóa nên **mỗi trang cache riêng** — bấm qua lại giữa các trang không phải tải lại. Component chỉ việc đọc `data / isLoading / isError` (xem `UsersPage.tsx`), không đụng tới `useEffect`/`fetch`.

---

## 4.5 — Silent refresh & bảo vệ route

### Khôi phục phiên khi F5 (`RootLayout.tsx`)

F5 làm mất access token trong RAM. Nhưng refresh token vẫn nằm trong httpOnly cookie. Nên khi app khởi động, ta thử khôi phục:

```ts
useEffect(() => {
  if (didBootstrap) return;   // guard StrictMode (giải thích ở mục bug bên dưới)
  didBootstrap = true;
  (async () => {
    try {
      const { accessToken } = await authApi.refresh();
      setAccessToken(accessToken);      // set token TRƯỚC khi gọi /me
      const { user } = await authApi.me();
      setAuth(accessToken, user);        // giờ mới lật status = authenticated
    } catch {
      clear();                           // không có phiên -> chưa đăng nhập
    }
  })();
}, [setAuth, setAccessToken, clear]);

if (status === "loading") return <Splash />;  // chờ xong mới render route
```

Trong lúc `status === "loading"`, ta hiện màn hình chờ và **không render route con** → tránh nháy trang login rồi mới nhảy vào dashboard.

### Route guards (`guards.tsx`)

```tsx
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  return <Outlet />;
}
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
```

Dùng `<Outlet/>` nên một guard bọc được **nhiều route con** trong `router.tsx` (cấu trúc lồng nhau). 

> ⚠️ Nhắc lại: guard ở frontend chỉ để **trải nghiệm** (ẩn/hiện, điều hướng). Bảo mật thật **luôn ở backend** — kẻ tấn công có thể sửa JS client tùy ý, nhưng không qua mặt được `authorize("ADMIN")` ở server.

### Nút OAuth (`LoginPage.tsx`)

```tsx
<a href="/api/auth/oauth/keycloak/login">Đăng nhập với Keycloak</a>
```

Là thẻ `<a>` (điều hướng cả trang) **chứ không phải** `axios`. Vì OAuth là một chuỗi *chuyển hướng cả trình duyệt* (sang Keycloak rồi quay lại), không phải một lời gọi AJAX. Sau khi xong, backend redirect về `/auth/callback`, nơi `OAuthCallbackPage` gọi `/refresh` + `/me` để hoàn tất (giống silent refresh).

---

## 🐛 Hai bug THẬT bắt được khi test trên trình duyệt

Cả hai đều **không** bị phát hiện bởi typecheck hay build — chỉ lộ ra khi chạy thật. Đây là lý do phải verify trong trình duyệt.

### Bug 1: Form báo "Required" dù đã gõ đủ

**Hiện tượng:** điền email + mật khẩu rồi bấm đăng nhập → React Hook Form vẫn báo "Required".

**Nguyên nhân:** component `Field` của ta là function component thường. React Hook Form (`register`) truyền vào một **`ref`** để đọc giá trị input. Nhưng `ref` là thuộc tính đặc biệt — truyền vào function component qua props thì **bị React nuốt mất**, không tới được thẻ `<input>` thật. Kết quả: RHF không đọc được giá trị nào → "Required".

**Sửa:** dùng `forwardRef` để chuyển tiếp `ref` xuống `<input>`:

```tsx
export const Field = forwardRef<HTMLInputElement, Props>(
  ({ label, error, ...props }, ref) => (
    <label>...<input ref={ref} {...props} />...</label>
  ),
);
```

> Bài học: bất kỳ component input dùng lại nào định dùng với RHF (hoặc cần focus/đo đạc) đều phải `forwardRef`.

### Bug 2: F5 trên `/users` bị đá về `/dashboard`

**Hiện tượng:** đang ở `/users`, F5 → phiên vẫn còn nhưng bị nhảy về `/dashboard` (mất deep-link).

**Nguyên nhân (tinh vi):** trong bootstrap ta gọi `refresh()` rồi `me()`, nhưng **chưa** set access token vào store trước khi gọi `me()`. Nên `me()` bị **401** → response interceptor nhảy vào tự refresh → gọi `setAccessToken(...)`. Ban đầu `setAccessToken` *cũng* lật `status = "authenticated"` — nhưng lúc đó `user` vẫn `null`. React render `/users` → `AdminRoute` thấy `user` null → tưởng không phải admin → `Navigate("/dashboard")`.

**Sửa (hai phần):**
1. `setAccessToken` **không** lật `status` nữa (chỉ `setAuth`/`clear` mới đổi status) → không còn trạng thái "authenticated mà user=null".
2. Bootstrap **set token trước khi gọi `me()`** → `me()` không còn 401 → không kích hoạt interceptor refresh thừa.

Kèm theo, ta thêm cờ module-level `didBootstrap` để chặn **StrictMode** (dev) gọi bootstrap 2 lần — vì hai lần `/refresh` gần đồng thời sẽ đụng rotation và có thể bị coi là *reuse* → thu hồi phiên oan.

> Bài học lớn: **thứ tự cập nhật state** và **trạng thái trung gian** là nguồn bug kinh điển ở frontend auth. Và interceptor "thông minh" (tự refresh) có thể tương tác bất ngờ với logic khởi động — phải nghĩ kỹ ai gọi ai, khi nào.

---

## Bài tập tự làm

1. Thêm trang "Hồ sơ" cho phép đổi tên (mutation PATCH), rồi `queryClient.invalidateQueries` để dữ liệu tự cập nhật.
2. Hiện toast khi login lỗi thay vì chữ đỏ tĩnh.
3. Thêm nút chuyển trang thật ở `UsersPage` và quan sát cache theo `queryKey` giữ dữ liệu trang cũ.
4. Thử để `ACCESS_TOKEN_TTL=15s` ở backend, ngồi yên 20s rồi bấm sang trang Users → xem interceptor tự refresh trong tab Network mà UI không hề gián đoạn.

---

## Tiếp theo → Phần 5: Message Queue

Tách các tác vụ nặng (gửi email chào mừng khi đăng ký, xử lý ảnh...) ra khỏi request bằng hàng đợi (BullMQ trên Redis) — producer/consumer/worker, retry, dead-letter.
```
