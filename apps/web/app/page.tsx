const nextSteps = [
  "เชื่อมหน้า Landing และ Login จาก Figma",
  "เชื่อม NEXT_PUBLIC_API_BASE_URL กับ Express API",
  "เพิ่ม Google OIDC ใน vertical slice ถัดไป",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Foundation Sprint</p>
        <h1 id="page-title">Learnly AI พร้อมเริ่มพัฒนาแล้ว</h1>
        <p className="lead">
          Next.js frontend และ Express.js API ใช้ TypeScript และตรวจคุณภาพผ่าน
          GitHub Actions ทุก Pull Request
        </p>

        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Application skeleton ready</strong>
            <p>หน้านี้เป็น placeholder ที่ Cake สามารถแทนด้วยงานจาก Figma ได้ทันที</p>
          </div>
        </div>

        <h2>งานถัดไป</h2>
        <ol>
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
