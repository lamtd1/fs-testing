// ============================================================================
//  gRPC SERVER của user-service — phục vụ gọi NỘI BỘ (auth-service).
// ----------------------------------------------------------------------------
//  Vì sao có cả REST (Phần trước) LẪN gRPC? Để bạn so sánh: cùng một việc
//  "lấy profile theo id", REST đi qua /api/internal/users/:id (JSON), còn gRPC
//  đi qua hợp đồng .proto (nhị phân, schema chặt, nhanh hơn cho gọi nội bộ dày đặc).
//  Thực tế hay dùng: REST/JSON ở biên, gRPC giữa các service.
// ============================================================================
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { USER_PROTO_PATH, REQUEST_ID_HEADER } from "@app/shared";
import type { GrpcProfile, GetProfileRequest } from "@app/shared";
import { userService } from "../modules/user/user.service.js";
import { logger } from "../lib/logger.js";

interface UserInternalService {
  service: grpc.ServiceDefinition;
}

export function startGrpcServer(port: number): grpc.Server {
  const packageDef = protoLoader.loadSync(USER_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDef) as unknown as {
    user: { UserInternal: UserInternalService };
  };

  const server = new grpc.Server();

  server.addService(proto.user.UserInternal.service, {
    async GetProfile(
      call: grpc.ServerUnaryCall<GetProfileRequest, GrpcProfile>,
      callback: grpc.sendUnaryData<GrpcProfile>,
    ) {
      // correlation-id đến qua metadata -> log cùng id với chuỗi gọi.
      const rid = call.metadata.get(REQUEST_ID_HEADER)[0];
      logger.debug({ requestId: rid, id: call.request.id }, "gRPC GetProfile");
      try {
        const user = await userService.getById(call.request.id);
        callback(null, { id: user.id, email: user.email, name: user.name });
      } catch {
        callback({ code: grpc.status.NOT_FOUND, message: "Profile không tồn tại" });
      }
    },
  });

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
    if (err) {
      logger.error({ err }, "gRPC bind lỗi");
      return;
    }
    logger.info(`🔌 user-service gRPC lắng nghe :${port}`);
  });

  return server;
}
