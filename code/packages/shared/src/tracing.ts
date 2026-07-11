// ============================================================================
//  DISTRIBUTED TRACING (OpenTelemetry) — dùng chung cho mọi service.
// ----------------------------------------------------------------------------
//  Auto-instrumentation tự bọc http/express/grpc/ioredis... -> mỗi request sinh
//  "span". OTel TỰ truyền ngữ cảnh trace (header W3C `traceparent`) qua HTTP &
//  gRPC -> spans ở gateway → auth → user GHÉP thành MỘT "trace" duy nhất trên
//  Jaeger. (Khác với x-request-id của ta: cái đó để gộp LOG; traceparent để gộp
//  SPAN. Dùng cả hai bổ trợ nhau.)
//
//  QUAN TRỌNG: phải gọi startTracing() TRƯỚC khi import http/express... nên mỗi
//  service có src/tracing.ts và `import "./tracing.js"` là DÒNG ĐẦU của index.ts.
// ============================================================================
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function startTracing(serviceName: string): NodeSDK | undefined {
  // Cho phép tắt (vd chạy test) mà không cần Jaeger.
  if (process.env.OTEL_SDK_DISABLED === "true") return undefined;

  // NodeSDK tự đọc OTEL_SERVICE_NAME -> đặt sẵn nếu chưa có.
  process.env.OTEL_SERVICE_NAME ??= serviceName;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  const stop = () => {
    void sdk.shutdown();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  return sdk;
}
