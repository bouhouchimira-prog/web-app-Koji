"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ClientDetail() {
  const params = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadClient();
    }
  }, [params.id]);

  const loadClient = async () => {
    try {
      // TODO: fetch from /api/entreprise/clients/:id
      setClient({ id: params.id, name: "Client Name", email: "client@example.com", phone: "0123456789" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <Link href="/entreprise/clients">
        <a style={{ color: "#0052cc", textDecoration: "none", fontWeight: "500", marginBottom: "24px", display: "block" }}>
          ← Retour
        </a>
      </Link>

      {loading && <div>Chargement…</div>}

      {!loading && client && (
        <>
          <h1 style={{ marginBottom: "32px" }}>{client.name}</h1>
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px" }}>
            <p>
              <strong>Email:</strong> {client.email}
            </p>
            <p>
              <strong>Téléphone:</strong> {client.phone}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
