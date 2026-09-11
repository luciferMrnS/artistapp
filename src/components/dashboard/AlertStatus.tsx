"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface StatusPayload {
  configured: {
    serverPublicKeySet: boolean;
    serverPrivateKeySet: boolean;
    nextPublicKeySet: boolean;
    publicKeyMatch: boolean;
    okay: boolean;
  };
  devices: {
    total: number;
    distinctUsers: number;
    byProvider: Record<string, number>;
    newestAt: string | null;
    oldestAt: string | null;
  };
}

/**
 * Pulls /api/alerts/status and explains, in plain words, whether push
 * delivery is actually set up and how many devices would receive an alert.
 */
export function AlertStatus() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alerts/status", { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json as StatusPayload);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the status endpoint.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-zinc-900 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" /> Delivery status
        </h2>
        <p className="flex items-center gap-2 text-sm text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking…
        </p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-border bg-zinc-900 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-5 w-5 text-primary" /> Delivery status
        </h2>
        <p className="text-sm text-red-300">{error || "Unknown error"}</p>
      </section>
    );
  }

  const { configured, devices } = data;

  return (
    <section className="rounded-2xl border border-border bg-zinc-900 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Activity className="h-5 w-5 text-primary" /> Delivery status
      </h2>

      <div className="space-y-3 text-sm">
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 ${
            configured.okay
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {configured.okay ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <span>
            {configured.okay
              ? "Push is configured correctly — alerts should deliver."
              : "Push is misconfigured — alerts are NOT being delivered. Check the VAPID keys in Render."}
          </span>
        </div>

        {!configured.okay && (
          <ul className="space-y-1 rounded-lg bg-black/40 p-3 text-xs text-secondary">
            <li>
              Server public key set:{" "}
              <span className={configured.serverPublicKeySet ? "text-emerald-400" : "text-red-400"}>
                {configured.serverPublicKeySet ? "yes" : "NO"}
              </span>
            </li>
            <li>
              Server private key set:{" "}
              <span className={configured.serverPrivateKeySet ? "text-emerald-400" : "text-red-400"}>
                {configured.serverPrivateKeySet ? "yes" : "NO"}
              </span>
            </li>
            <li>
              Client (NEXT_PUBLIC) key set:{" "}
              <span className={configured.nextPublicKeySet ? "text-emerald-400" : "text-red-400"}>
                {configured.nextPublicKeySet ? "yes" : "NO"}
              </span>
            </li>
            <li>
              Client &amp; server keys match:{" "}
              <span className={configured.publicKeyMatch ? "text-emerald-400" : "text-red-400"}>
                {configured.publicKeyMatch ? "yes" : "NO — this breaks every push"}
              </span>
            </li>
          </ul>
        )}

        <div className="rounded-lg bg-black/40 p-3 text-xs text-secondary">
          <p className="flex justify-between">
            <span>Registered devices (would receive an alert)</span>
            <span className="font-semibold text-white">{devices.total}</span>
          </p>
          <p className="flex justify-between">
            <span>Distinct users</span>
            <span className="font-semibold text-white">{devices.distinctUsers}</span>
          </p>
          {Object.keys(devices.byProvider).length > 0 && (
            <p className="flex justify-between">
              <span>Platforms</span>
              <span className="text-right">
                {Object.entries(devices.byProvider)
                  .map(([host, count]) => `${host.split(".")[0] ?? host}: ${count}`)
                  .join(" · ")}
              </span>
            </p>
          )}
          {devices.oldestAt && (
            <p className="flex justify-between">
              <span>First subscribed</span>
              <span>{new Date(devices.oldestAt).toLocaleDateString()}</span>
            </p>
          )}
          {devices.newestAt && (
            <p className="flex justify-between">
              <span>Last subscribed</span>
              <span>{new Date(devices.newestAt).toLocaleDateString()}</span>
            </p>
          )}
        </div>

        {!!configured.okay && devices.total === 0 && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
            Push is configured, but no devices are registered. Fans must install
            the app (Add to Home Screen) and allow notifications.
          </p>
        )}
      </div>
    </section>
  );
}