// ============================================================================
//  gRPC CLIENT sang user-service (READ profile) — có RESILIENCE (6.7).
//   - DEADLINE: mỗi call gRPC có hạn 2s (tương đương timeout).
//   - CIRCUIT BREAKER: user-service hỏng liên tục -> mở mạch, trả null NGAY
//     (login vẫn chạy, name fallback) thay vì chờ từng call timeout.
// ============================================================================
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import CircuitBreaker from "opossum";
import { USER_PROTO_PATH, REQUEST_ID_HEADER, getRequestId, serviceRegistry } from "@app/shared";
import type { GrpcProfile } from "@app/shared";

interface UserInternalClient extends grpc.Client {
  GetProfile(
    req: { id: string },
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    cb: (err: grpc.ServiceError | null, res?: GrpcProfile) => void,
  ): void;
}

const packageDef = protoLoader.loadSync(USER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef) as unknown as {
  user: {
    UserInternal: new (addr: string, creds: grpc.ChannelCredentials) => UserInternalClient;
  };
};

const client = new proto.user.UserInternal(
  serviceRegistry.userGrpc(),
  grpc.credentials.createInsecure(),
);

const DEADLINE_MS = 2000;

// Một LẦN gọi gRPC, reject nếu lỗi/deadline (để breaker đếm được).
function attemptGetProfile(id: string): Promise<GrpcProfile> {
  return new Promise((resolve, reject) => {
    const md = new grpc.Metadata();
    const rid = getRequestId();
    if (rid) md.set(REQUEST_ID_HEADER, rid);
    const options: grpc.CallOptions = { deadline: new Date(Date.now() + DEADLINE_MS) };
    client.GetProfile({ id }, md, options, (err, res) => {
      if (err || !res) return reject(err ?? new Error("empty response"));
      resolve(res);
    });
  });
}

const breaker = new CircuitBreaker(attemptGetProfile, {
  timeout: DEADLINE_MS + 500,
  errorThresholdPercentage: 50,
  resetTimeout: 10_000,
  volumeThreshold: 3,
});
// Best-effort: mọi lỗi/mở-mạch -> null (login vẫn chạy, name fallback).
breaker.fallback(() => null);

export const userGrpcClient = {
  async getProfile(id: string): Promise<GrpcProfile | null> {
    return (await breaker.fire(id)) as GrpcProfile | null;
  },
};
