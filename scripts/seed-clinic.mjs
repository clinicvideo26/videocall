// One-time onboarding seed (v2 §3: accounts exist before first login).
// Creates a clinic + an admin account and attaches any pre-v2 consultations to
// that clinic. Idempotent — safe to re-run. The admin then adds doctors and
// reception staff through the Admin UI.
//
//   node --env-file=.env scripts/seed-clinic.mjs
//
// Override defaults with env vars: CLINIC_NAME, CLINIC_WHATSAPP,
// ADMIN_PHONE, ADMIN_NAME.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const clinicName = process.env.CLINIC_NAME || "Demo Clinic";
const clinicWhatsapp = process.env.CLINIC_WHATSAPP || process.env.CLINIC_WHATSAPP_NUMBER || "";
const adminPhone = (process.env.ADMIN_PHONE || "9999999999").replace(/\D/g, "");
const adminName = process.env.ADMIN_NAME || "Admin";

// Clinic — reuse the first one if it already exists, else create it.
let clinic = await prisma.clinic.findFirst({ orderBy: { createdAt: "asc" } });
if (!clinic) {
  clinic = await prisma.clinic.create({
    data: { name: clinicName, whatsappNumber: clinicWhatsapp },
  });
  console.log(`Created clinic "${clinic.name}" (${clinic.id})`);
} else {
  console.log(`Using existing clinic "${clinic.name}" (${clinic.id})`);
}

// Admin — keyed by phone (unique).
let admin = await prisma.user.findUnique({ where: { phone: adminPhone } });
if (!admin) {
  admin = await prisma.user.create({
    data: { clinicId: clinic.id, phone: adminPhone, role: "admin", name: adminName },
  });
  console.log(`Created admin ${admin.name} — login phone: ${admin.phone}`);
} else {
  console.log(`Admin already exists — login phone: ${admin.phone} (role: ${admin.role})`);
}

// Backfill pre-v2 consultations so they belong to this clinic.
const backfilled = await prisma.consultation.updateMany({
  where: { clinicId: null },
  data: { clinicId: clinic.id },
});
console.log(`Backfilled ${backfilled.count} existing consultation(s) to this clinic.`);

console.log("\nDone. Log in with phone:", adminPhone, "(OTP shows in the server log in dev mode).");

await prisma.$disconnect();
