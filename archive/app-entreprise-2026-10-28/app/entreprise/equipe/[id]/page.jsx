"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function TeamMemberDetail() {
  const params = useParams();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadMember();
    }
  }, [params.id]);

  const loadMember = async () => {
    try {
      // TODO: fetch from /api/entreprise/equipe/:id
      setMember({ id: params.id, name: "Member Name", email: "member@example.com", role: "Employé" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <Link href="/entreprise/equipe">
        <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500", marginBottom: "24px", display: "block" }}>
          ← Retour
        </a>
      </Link>

      {loading && <div>Chargement…</div>}

      {!loading && member && (
        <>
          <h1 style={{ marginBottom: "32px" }}>{member.name}</h1>
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px" }}>
            <p>
              <strong>Email:</strong> {member.email}
            </p>
            <p>
              <strong>Rôle:</strong> {member.role}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
