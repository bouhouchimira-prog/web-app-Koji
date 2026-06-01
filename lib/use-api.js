"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./client-api";

export function useApi(path, key, fallback = []) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiGet(path)
      .then((payload) => {
        if (alive) setData(payload[key] ?? fallback);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, key]);

  return { data, loading, setData };
}
