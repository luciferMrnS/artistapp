import webpush from "web-push";
import {
  getCombinedUnreadCount,
  getAllPushSubscriptions,
  getPushSubscriptionsForUser,
  getPushSubscriptionUserIds,
  removePushSubscription,
  markCreedReadServer,
} from "@/lib/db";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = "mailto:iamkendrickdavid@gmail.com";

// If VAPID keys are missing, every send short-circuits into a no-op log —
// the app keeps working, notifications just don't fire until they're set.
const vapidConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (vapidConfigured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

export const PUSH_TAG = "kendrick-unread";
export const HARD_ALERT_TAG = "kendrick-alert";

// Hard alerts carry the full message text in the push body, which is
// VAPID-encrypted and capped at ~4KB by the platform. Keep messages short
// enough to fit even with emoji/multi-byte content in the payload.
export const MAX_ALERT_LENGTH = 1200;

/** Prune dead subscriptions (404/410) reported by the push provider. */
function cleanupDeadSubscriptions<T extends { endpoint: string }>(
  subscriptions: T[],
  results: PromiseSettledResult<unknown>[]
): { sent: number; failed: number } {
  let sent = 0;
  let failed = 0;
  results.forEach((result, i) => {
    const sub = subscriptions[i];
    if (!sub) return;
    if (result.status === "fulfilled") {
      sent += 1;
    } else {
      failed += 1;
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        removePushSubscription(sub.endpoint);
      } else {
        console.error("Push send failed:", err);
      }
    }
  });
  return { sent, failed };
}

interface SendOptions {
  /** Which surface triggered this push: "creed" | "dm" */
  trigger: "creed" | "dm";
  /** Opening URL when the notification is tapped. */
  url: string;
  /** Recipient of the new message that just arrived. */
  userId: string;
}

/**
 * Send an unread-count push to every device subscribed for `userId`.
 * The notification shows the combined unread total (Creed + DMs) and uses a
 * single tag so later pushes replace the banner instead of stacking.
 */
export async function sendUnreadPush({ trigger, url, userId }: SendOptions) {
  if (!vapidConfigured) {
    console.warn("VAPID keys not configured — skipping push notification");
    return;
  }

  try {
    const [{ total, creed, dm }, subscriptions] = await Promise.all([
      getCombinedUnreadCount(userId),
      getPushSubscriptionsForUser(userId),
    ]);

    if (subscriptions.length === 0) return;

    const body =
      total > 0
        ? `${total === 1 ? "1 new message" : `${total} new messages`} — Creed ${creed} · DMs ${dm}`
        : "You're all caught up";

    const payload = JSON.stringify({
      title: trigger === "creed" ? "Kendrick David · Creed" : "Kendrick David · DMs",
      body,
      tag: PUSH_TAG,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url, badgeCount: total },
      timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    );

    cleanupDeadSubscriptions(subscriptions, results);
  } catch (err) {
    console.error("Failed to send unread push:", err);
  }
}

/** Reset the recipient's Creed baseline — call when they open the chat. */
export async function markCreedReadForUser(userId: string) {
  await markCreedReadServer(userId);
}

/**
 * A new Creed message just arrived — ping every subscribed user except the
 * sender so nobody gets a notification for their own message.
 */
export async function sendCreedPushToEveryone({
  exceptUserId,
}: {
  exceptUserId: string;
}) {
  const userIds = await getPushSubscriptionUserIds();
  await Promise.allSettled(
    userIds
      .filter((id) => id !== exceptUserId)
      .map((id) =>
        sendUnreadPush({ trigger: "creed", url: "/fan-club", userId: id })
      )
  );
}

/**
 * Send a hard alert to every installed device.
 *
 * Unlike the unread-count banners, the full message text is delivered in the
 * notification body so fans see the whole update without opening the app.
 * Uses its own tag so it never gets clobbered by (or clobbers) the unread
 * banner, and the service worker keeps it on screen (`requireInteraction`)
 * with a vibration on phones.
 */
export async function sendHardAlertToEveryone({
  title,
  message,
  url = "/",
  exceptUserId,
}: {
  title: string;
  message: string;
  url?: string;
  exceptUserId?: string;
}): Promise<{ devices: number; sent: number; failed: number }> {
  if (!vapidConfigured) {
    console.warn("VAPID keys not configured — skipping hard alert");
    return { devices: 0, sent: 0, failed: 0 };
  }

  const subscriptions = await getAllPushSubscriptions();
  if (subscriptions.length === 0) {
    return { devices: 0, sent: 0, failed: 0 };
  }

  const recipients = exceptUserId
    ? subscriptions.filter((sub) => sub.user_id !== exceptUserId)
    : subscriptions;
  if (recipients.length === 0) {
    return { devices: recipients.length, sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body: message,
    tag: HARD_ALERT_TAG,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url, badgeCount: 0, type: "hard-alert" },
    timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    recipients.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 86_400, urgency: "high" }
      )
    )
  );

  const { sent, failed } = cleanupDeadSubscriptions(recipients, results);
  return { devices: recipients.length, sent, failed };
}