# End-to-End Tests

Smoke test แรกต้องครอบคลุม:

```text
Google auth stub/session → create session → add mock material
→ mock tutor output → save interaction → session appears in history
```

E2E test ไม่ควรเรียก Google หรือ paid AI provider จริงใน CI ให้ใช้ stub/mock ที่ deterministic

