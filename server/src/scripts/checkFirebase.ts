import { db } from "../config/firebaseAdmin.js";

try {
  const settingsSnapshot = await db.collection("event_settings").doc("current").get();

  console.log(
    settingsSnapshot.exists
      ? "Firebase connection succeeded. event_settings/current exists."
      : "Firebase connection succeeded, but event_settings/current does not exist yet."
  );
  process.exitCode = 0;
} catch (error) {
  console.error("Firebase connection failed.", error);
  process.exitCode = 1;
}