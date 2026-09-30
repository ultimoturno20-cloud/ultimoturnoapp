import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { createManagedUser, createOperationalDatabase, getDefaultOperationalUser, loginUser } from "./index.js";

it("locks an email after repeated failed logins, even with the right password", async () => {
  const db = await createOperationalDatabase({ dataDir: await mkdtemp(path.join(tmpdir(), "ultimoturno-login-")) });
  const admin = { ...(await getDefaultOperationalUser(db)), roles: ["admin"] };
  await createManagedUser(db, { displayName: "Seba", email: "seba@test.local", password: "password-segura-123", role: "stock_owner" }, admin);
  // A successful login clears earlier failures.
  await assert.rejects(loginUser(db, "seba@test.local", "mal", "1.1.1.1"), (error: Error & { statusCode?: number }) => error.statusCode === 401);
  await loginUser(db, "seba@test.local", "password-segura-123", "1.1.1.1");
  for (let attempt = 0; attempt < 10; attempt++) {
    await assert.rejects(loginUser(db, "SEBA@test.local", "mal", "1.1.1.1"), /incorrectos/);
  }
  await assert.rejects(loginUser(db, "seba@test.local", "password-segura-123", "2.2.2.2"), (error: Error & { statusCode?: number }) => error.statusCode === 429);
});
