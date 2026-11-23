import PageHeader from "@/components/PageHeader";
import ResourcesView from "@/components/ResourcesView";

export default function Home() {
  return (
    <>
      <PageHeader eyebrow="RESOURCE MANAGEMENT" title="Resources" />
      <ResourcesView />
    </>
  );
}
