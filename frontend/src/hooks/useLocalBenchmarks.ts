import { useState, useEffect } from "react";
import { BenchmarkResult } from "@/lib/doh";

export interface LocalBenchmarkRecord {
  id: string;
  user_id: string;
  domain: string;
  provider: string;
  latency_ms: number | null;
  success: boolean;
  method: string;
  error?: string | null;
  tested_at: string;
  keep?: boolean;
}

const STORAGE_KEY = "dns_benchmarks";
const MAX_RECORDS = 50;

export function useLocalBenchmarks() {
  const [localHistory, setLocalHistory] = useState<LocalBenchmarkRecord[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLocalHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load local benchmarks", e);
    }
  }, []);

  const addLocalBenchmarks = (records: LocalBenchmarkRecord[]) => {
    setLocalHistory((prev) => {
      const updated = [...records, ...prev].slice(0, MAX_RECORDS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save local benchmarks", e);
      }
      return updated;
    });
  };

  const toggleKeepLocal = (id: string, keep: boolean) => {
    setLocalHistory((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, keep } : item
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save local benchmarks", e);
      }
      return updated;
    });
  };

  return { localHistory, addLocalBenchmarks, toggleKeepLocal };
}
