import TeamManager from "@/component/teamcustom/TeamManager";

export const metadata = {
  title: "TeamBuild - Manage",
};

export default function TeamBuildListPage() {
  return <TeamManager mode="arrange" />;
}
