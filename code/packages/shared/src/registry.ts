// ============================================================================
//  SERVICE REGISTRY — "danh bạ" phân giải TÊN service -> ĐỊA CHỈ.
// ----------------------------------------------------------------------------
//  Vấn đề: URL service bị rải rác, hardcode khắp nơi ("http://localhost:4002").
//  Đổi port/host là phải sửa nhiều chỗ. Giải: mọi caller hỏi registry
//  "user-service ở đâu?" thay vì tự dựng URL.
//
//  Ở dev: registry đọc từ ENV (đã nạp qua dotenv) + default hợp lý.
//  Ở production: chỉ cần THAY RUỘT hàm dưới bằng Consul / etcd / k8s DNS
//  (vd resolve "user-service.default.svc.cluster.local") — CODE GỌI KHÔNG ĐỔI.
//  Đây chính là tinh thần "service discovery".
// ============================================================================

// Nguồn sự thật cho địa chỉ mặc định (config tập trung, hết magic number rải rác).
const DEFAULTS = {
  gatewayHttp: "http://localhost:4000",
  authHttp: "http://localhost:4001",
  userHttp: "http://localhost:4002",
  userGrpc: "localhost:4092",
} as const;

export const serviceRegistry = {
  gatewayHttp: () => process.env.GATEWAY_URL ?? DEFAULTS.gatewayHttp,
  authHttp: () => process.env.AUTH_SERVICE_URL ?? DEFAULTS.authHttp,
  userHttp: () => process.env.USER_SERVICE_URL ?? DEFAULTS.userHttp,
  userGrpc: () => process.env.USER_SERVICE_GRPC ?? DEFAULTS.userGrpc,
};

export type ServiceRegistry = typeof serviceRegistry;
