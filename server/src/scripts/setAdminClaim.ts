import { adminAuth } from "../config/firebaseAdmin.js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: npm run set:admin -- user@example.com");
  process.exit(1);
}

try {
  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: "admin" });
  console.log(`Admin role assigned to ${user.email}. Sign out and sign in again to refresh the ID token.`);
} catch (error) {
  console.error("Could not assign admin role", error);
  process.exitCode = 1;
}