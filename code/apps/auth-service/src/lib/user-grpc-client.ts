// ============================================================================
//  gRPC CLIENT sang user-service (dùng cho READ profile lúc login/me).
// ----------------------------------------------------------------------------
//  Ghi (create/delete profile) vẫn qua REST (user-client.ts); ĐỌC dùng gRPC để
//  bạn thấy cả hai kiểu. Cùng truyền correlation-id (qua metadata) như REST.
// ============================================================================
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { USER_PROTO_PATH, REQUEST_ID_HEADER, getRequestId } from "@app/shared";
import type { GrpcProfile } from "@app/shared";
import { env } from "../config/env.js";

interface UserInternalClient extends grpc.Client {
  GetProfile(
    req: { id: string },
    metadata: grpc.Metadata,
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
  env.USER_SERVICE_GRPC,
  grpc.credentials.createInsecure(),
);

export const userGrpcClient = {
  // best-effort như REST getProfile: lỗi/timeout -> null để login vẫn chạy.
  getProfile(id: string): Promise<GrpcProfile | null> {
    return new Promise((resolve) => {
      const md = new grpc.Metadata();
      const rid = getRequestId();
      if (rid) md.set(REQUEST_ID_HEADER, rid); // correlation-id qua gRPC metadata
      client.GetProfile({ id }, md, (err, res) => {
        resolve(err || !res ? null : res);
      });
    });
  },
};
