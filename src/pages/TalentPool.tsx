import TalentPoolComponent from "@/components/TalentPool";

export default function TalentPool() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Talent Pool</h1>
      </div>
      <TalentPoolComponent />
    </div>
  );
}
