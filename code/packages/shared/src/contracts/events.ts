// CONTRACT sự kiện bất đồng bộ (qua BullMQ/Redis). Producer (auth-service) và
// consumer (notification-service) CÙNG import -> tên queue + kiểu job không lệch.
export const EMAIL_QUEUE = "email";
export const EMAIL_DLQ = "email-dead";

export interface WelcomeEmailJob {
  userId: string;
  email: string;
  name: string;
}
