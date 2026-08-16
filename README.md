# نبض بازار v5

این نسخه از «دموی ظاهری» به هسته سرویس نزدیک‌تر شده است:
- SQLite برای تاریخچه قیمت و هشدارها
- cache کوتاه‌مدت سمت سرور
- اعتبارسنجی Telegram initData با HMAC-SHA-256
- تاریخچه قیمت
- هشدارهای ذخیره‌شده
- fail-closed: بدون provider معتبر، عدد نمایش داده نمی‌شود.

## مهم‌ترین محدودیت
من عمداً API خاصی را حدس نزدم. برای قیمت واقعی طلا/دلار/USDT باید یک provider دارای API و مجوز استفاده انتخاب شود و adapter آن دقیقاً طبق مستندات همان provider نوشته شود. این مرحله نیازمند کلید API یا دسترسی سرویس است.

## اجرا
npm install
cp .env.example .env
npm start

برای production:
- HTTPS
- reverse proxy
- backup SQLite یا PostgreSQL
- secret manager
- monitoring/health checks
- provider اصلی + provider دوم برای کنترل اختلاف
- rate limiting
- لاگ بدون ذخیره secrets
