import { useState } from "react";
import TalentPoolComponent from "@/components/TalentPool";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TalentPool() {
  const [activeTab, setActiveTab] = useState("free");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Talent Pool</h1>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="free">Free</TabsTrigger>
          <TabsTrigger value="placed">Placed</TabsTrigger>
        </TabsList>
        <TabsContent value="free">
          <TalentPoolComponent filter="free" />
        </TabsContent>
        <TabsContent value="placed">
          <TalentPoolComponent filter="placed" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
