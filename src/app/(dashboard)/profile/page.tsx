import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { User as UserIcon, Mail, Lock } from "lucide-react";
import { UserProfileEditor } from "@/components/user-profile-editor";
import { UserNotificationsEditor } from "@/components/user-notifications-editor";
import { PasswordChangeForm } from "@/components/password-change-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const sectionClass =
    "bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6";
  const sectionHeader = "flex items-center gap-2 mb-4";
  const sectionTitle = "font-semibold text-gray-900 inline-flex items-center gap-2";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Signed in as {user.name} · <span className="capitalize">{user.role}</span>
        </p>
      </div>

      <div className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <UserIcon size={16} /> Profile
          </h2>
        </div>
        <UserProfileEditor
          userId={user.id}
          initial={{
            firstName: user.firstName ?? user.name.split(" ")[0] ?? "",
            lastName: user.lastName ?? user.name.split(" ").slice(1).join(" ") ?? "",
            email: user.email,
          }}
        />
      </div>

      <div className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Mail size={16} /> Notification Preferences
          </h2>
        </div>
        <UserNotificationsEditor
          userId={user.id}
          initial={{
            phone: user.phone,
            carrier: user.carrier,
            notifyEmail: user.notifyEmail,
            notifySMS: user.notifySMS,
          }}
        />
      </div>

      <div className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Lock size={16} /> Change Password
          </h2>
        </div>
        <PasswordChangeForm userId={user.id} />
      </div>
    </div>
  );
}
