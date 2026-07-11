-- Chạy MỘT LẦN khi Postgres khởi tạo lần đầu (docker-entrypoint-initdb.d).
-- Tạo DB RIÊNG cho từng service (database-per-service) trên cùng một instance.
CREATE DATABASE app_auth;
CREATE DATABASE app_user;
