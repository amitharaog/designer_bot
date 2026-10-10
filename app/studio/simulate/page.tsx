import Simulator from "@/components/studio/Simulator";
import StudioNav, { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";

export default async function SimulatePage(props: PageProps<"/studio/simulate">) {
  const q = await props.searchParams;
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  return (
    <>
      <StudioNav k={key} active="simulate" />
      <main className="px-4 pb-20 pt-6"><Simulator k={key} /></main>
    </>
  );
}
