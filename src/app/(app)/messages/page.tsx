import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { PageHeader } from "@/components/ui/card";
import { MessagesClient } from "./messages-client";
import type { Auditor, District, Message } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadData(): Promise<{
  messages: Message[];
  districts: District[];
  auditors: Auditor[];
}> {
  if (!isAdminConfigured()) {
    return { messages: [], districts: [], auditors: [] };
  }

  const db = adminDb();
  const [messageSnap, districtSnap, auditorSnap] = await Promise.all([
    db.collection("messages").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("districts").orderBy("name").get(),
    db.collection("auditors").orderBy("name").get(),
  ]);

  return {
    messages: messageSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Message,
    ),
    districts: districtSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as District,
    ),
    auditors: auditorSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Auditor,
    ),
  };
}

export default async function MessagesPage() {
  const { messages, districts, auditors } = await loadData();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Messages"
        description="Reach auditors directly — all of them, one district, or a named few."
      />
      <MessagesClient
        messages={messages}
        districts={districts}
        auditors={auditors}
      />
    </div>
  );
}
