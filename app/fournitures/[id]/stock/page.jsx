"use client";

import { useRouter } from "next/navigation";
import { Shell } from "../../../../components/Shell";

export default function StockPage() {
  const router = useRouter();
  const stock = [
    { id: 1, article: "Carrelage 60x60", available: 40, reserved: 10, total: 50 },
    { id: 2, article: "Ciment blanc", available: 3, reserved: 2, total: 5 },
    { id: 3, article: "Robinetterie", available: 1, reserved: 0, total: 1 }
  ];

  return (
    <Shell>
      <div className="head">
        <button className="link" onClick={() => router.back()}>← Retour</button>
        <h1>Stock</h1>
      </div>

      <div className="card">
        <div className="card-h"><h2>État du stock</h2></div>
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Disponible</th>
                <th>Réservé</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id}>
                  <td>{s.article}</td>
                  <td className="n">{s.available}</td>
                  <td className="sm">{s.reserved}</td>
                  <td className="n">{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
