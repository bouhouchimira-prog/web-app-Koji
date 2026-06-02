import { badRequest, ok } from "../../../../lib/http";
import { addHistory, publicUser, readDb, writeDb } from "../../../../lib/db";

function findUser(db, userId) {
  if (userId) {
    const exact = db.users.find((candidate) => candidate.id === userId);
    if (exact) return exact;
  }
  return db.users[0];
}

function createLocalUser(seed = {}) {
  const now = Date.now();
  return {
    id: seed.userId || `u-${now}`,
    email: seed.email || `local-${now}@koji.local`,
    password: seed.password || "",
    name: seed.name || "Utilisateur Koji",
    accountType: seed.accountType || "entreprise",
    isActive: true,
    businessInfoComplete: false,
    profileComplete: false,
    business: {},
    professions: []
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = new URL(request.url).searchParams.get("userId");
  const user = findUser(db, userId);
  if (!user) return ok({ user: null });
  return ok({ user: publicUser(user) });
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  let user = findUser(db, body.userId);
  if (!user) {
    user = createLocalUser({
      userId: body.userId,
      name: body.name,
      email: body.email,
      accountType: body.accountType
    });
    db.users.push(user);
  }

  if (body.business) {
    user.business = { ...user.business, ...body.business };
    user.businessInfoComplete = true;
  }
  if (body.professions) {
    user.professions = body.professions;
    user.profileComplete = body.professions.length > 0;
  }
  if (body.accountType) {
    user.accountType = body.accountType;
  }
  user.updatedAt = new Date().toISOString();

  addHistory(db, {
    userId: user.id,
    type: "profile.updated",
    label: "Profil enregistre",
    entityId: user.id,
    entityType: "user",
    meta: {
      businessInfoComplete: user.businessInfoComplete,
      profileComplete: user.profileComplete
    }
  });

  await writeDb(db);
  return ok({ user: publicUser(user) });
}
