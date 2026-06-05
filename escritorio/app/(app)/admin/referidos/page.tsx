import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/panel?tab=referidos");
}
