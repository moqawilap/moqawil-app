import { ReplitConnectors } from "@replit/connectors-sdk";

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "moqawil.om@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || "Moqawil <onboarding@resend.dev>";
const USES_RESEND_TEST_SENDER = FROM_EMAIL.toLowerCase().includes("onboarding@resend.dev");

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function isDeliverableEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    && domain !== "example.com"
    && domain !== "example.net"
    && domain !== "example.org"
    && !domain.endsWith(".invalid");
}

function emailLayout(title: string, intro: string, rows: Array<[string, string]>) {
  const rowMarkup = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;color:#64748b;font-size:13px;width:145px">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(value)}</td>
    </tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px">
      <div style="background:#08284a;border-radius:18px 18px 0 0;padding:22px;color:#fff">
        <div style="font-size:12px;letter-spacing:1px;font-weight:700">MOQAWIL · مقاول</div>
        <h1 style="margin:14px 0 0;font-size:22px">${escapeHtml(title)}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 18px 18px;padding:22px">
        <p style="font-size:16px;line-height:1.8;margin-top:0">${escapeHtml(intro)}</p>
        <table style="width:100%;border-collapse:collapse">${rowMarkup}</table>
        <p style="color:#64748b;font-size:12px;line-height:1.7;margin-bottom:0">يمكنك مراجعة التفاصيل من لوحة إدارة تطبيق مقاول.</p>
      </div>
    </div>
  </body></html>`;
}

async function sendAdminEmail(subject: string, html: string, adminEmails: string[] = []) {
  const requestedRecipients = USES_RESEND_TEST_SENDER ? [ADMIN_EMAIL] : [...adminEmails, ADMIN_EMAIL];
  const recipients = [...new Set(requestedRecipients.map((email) => email.trim().toLowerCase()).filter(isDeliverableEmail))];
  if (!recipients.length) throw new Error("No deliverable admin email address is configured");
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("resend", "/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: recipients,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend email failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export async function emailAdminContact(input: {
  customerName: string;
  customerEmail: string;
  adminEmails?: string[];
  channel: "call" | "whatsapp";
  category: string;
  subjectName: string;
  occurredAt: Date;
}) {
  const channelLabel = input.channel === "call" ? "اتصال هاتفي" : "واتساب";
  const categoryLabel = {
    property: "عقار",
    workshop: "ورشة",
    design: "تصميم",
    maintenance: "صيانة",
    contractor: "مقاول",
  }[input.category] ?? input.category;
  await sendAdminEmail(
    `تواصل جديد عبر مقاول: ${channelLabel}`,
    emailLayout("تواصل جديد من عميل", "قام عميل بالتواصل مع أحد الإعلانات أو مقدمي الخدمة.", [
      ["اسم العميل", input.customerName || "غير مذكور"],
      ["بريد العميل", input.customerEmail],
      ["نوع التواصل", channelLabel],
      ["الفئة", categoryLabel],
      ["الإعلان أو الخدمة", input.subjectName],
      ["وقت التواصل", input.occurredAt.toLocaleString("ar-OM", { timeZone: "Asia/Muscat" })],
    ]),
    input.adminEmails,
  );
}

export async function emailAdminServiceRequest(input: {
  customerName: string;
  customerEmail: string;
  adminEmails?: string[];
  serviceName: string;
  serviceCategory: string;
  governorate: string;
  wilayat: string;
  requirements: string;
  occurredAt: Date;
}) {
  await sendAdminEmail(
    `طلب خدمة جديد عبر مقاول: ${input.serviceName}`,
    emailLayout("طلب خدمة جديد من عميل", "أرسل عميل طلب خدمة جديدًا عبر تطبيق مقاول.", [
      ["اسم العميل", input.customerName || "غير مذكور"],
      ["بريد العميل", input.customerEmail],
      ["اسم الخدمة", input.serviceName],
      ["الفئة", input.serviceCategory],
      ["المحافظة", input.governorate],
      ["الولاية", input.wilayat],
      ["المتطلبات", input.requirements],
      ["وقت الطلب", input.occurredAt.toLocaleString("ar-OM", { timeZone: "Asia/Muscat" })],
    ]),
    input.adminEmails,
  );
}