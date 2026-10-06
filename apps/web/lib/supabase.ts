import { createClient } from "@supabase/supabase-js";

// ค่าฝั่ง browser ต้องเป็นค่า public เท่านั้น (ใส่ใน apps/web/.env.local)
// ห้ามใส่ DATABASE_URL / service_role / Google Client Secret ที่นี่เด็ดขาด
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local"
  );
}

// สร้าง client ตัวเดียวแล้ว import ไปใช้ทุกที่ (อย่าสร้างซ้ำใน component)
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
