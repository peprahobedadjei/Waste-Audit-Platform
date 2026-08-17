import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/session";
import { currentScope, loadLookups } from "@/lib/queries";
import { PageHeader } from "@/components/ui/card";
import { MessagesClient, type StaffOption } from "./messages-client";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  const scope = await currentScope();

  // Districts and auditors already come back scoped to this person
  const { districts, auditors } = await loadLookups(scope);

  let messages: Message[] = [];
  let staff: StaffOption[] = [];

  if (isAdminConfigured() && user) {
    const db = adminDb();
    const [messageSnap, userSnap] = await Promise.all([
      db.collection("messages").orderBy("createdAt", "desc").limit(200).get(),
      db.collection("users").orderBy("name").get(),
    ]);

    messages = messageSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Message,
    );

    /*
      The system administrator sees every message. Sub-admins see what they
      sent and what was addressed to them. This mirrors the same rule in the
      API - the screen must not show more than the endpoint would return.
    */
    if (user.role !== "admin") {
      messages = messages.filter(
        (m) =>
          m.sentBy === user.uid ||
          (m.audience.type === "staff" &&
            (m.audience.userIds ?? []).includes(user.uid)),
      );
    }

    staff = userSnap.docs
      .filter((doc) => doc.id !== user.uid && doc.data().status !== "inactive")
      .map((doc) => ({
        id: doc.id,
        name: doc.data().name as string,
        email: doc.data().email as string,
        role: doc.data().role as string,
      }));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Messages"
        description={
          user?.role === "admin"
            ? "Reach auditors and sub-admins. As system administrator you can see every message sent."
            : "Reach the auditors assigned to you, or message other sub-admins."
        }
      />
      <MessagesClient
        messages={messages}
        districts={districts}
        auditors={auditors}
        staff={staff}
        isAdmin={user?.role === "admin"}
      />
    </div>
  );
}
