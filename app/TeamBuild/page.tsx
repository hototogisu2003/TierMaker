import { redirect } from "next/navigation";

export const metadata = {
  title: "TeamBuild",
};

export default function TeamBuildPage() {
  redirect("/TeamBuild/team");
}
