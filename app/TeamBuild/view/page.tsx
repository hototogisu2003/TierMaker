import { redirect } from "next/navigation";

export const metadata = {
  title: "TeamBuild - Manage",
};

export default function TeamBuildViewPage() {
  redirect("/TeamBuild/list");
}
