import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAudit, getUserName } from "@/lib/audit-logger";

interface KeyPerson {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  contact_number: string | null;
}

export default function KeyPeople({ clientProfileId, editable = true }: { clientProfileId: string; editable?: boolean }) {
  const { user } = useAuth();
  const [people, setPeople] = useState<KeyPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeople = async () => {
    const { data } = await supabase
      .from("key_people")
      .select("*")
      .eq("client_profile_id", clientProfileId)
      .order("created_at");
    if (data) setPeople(data as KeyPerson[]);
    setLoading(false);
  };

  useEffect(() => { fetchPeople(); }, [clientProfileId]);

  const addPerson = async () => {
    const { data, error } = await supabase
      .from("key_people")
      .insert({ client_profile_id: clientProfileId, name: "" })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setPeople([...people, data as KeyPerson]);
  };

  const updatePerson = async (id: string, field: string, value: string) => {
    setPeople((p) => p.map((person) => person.id === id ? { ...person, [field]: value } : person));
    await supabase.from("key_people").update({ [field]: value }).eq("id", id);
  };

  const deletePerson = async (id: string) => {
    await supabase.from("key_people").delete().eq("id", id);
    setPeople((p) => p.filter((person) => person.id !== id));
    toast.success("Entry removed");
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Key People</CardTitle>
        {editable && (
          <Button size="sm" onClick={addPerson}><Plus className="mr-1 h-4 w-4" />Add Person</Button>
        )}
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No key people added yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Contact Number</TableHead>
                {editable && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Input value={p.name} onChange={(e) => updatePerson(p.id, "name", e.target.value)} className="h-8" disabled={!editable} />
                  </TableCell>
                  <TableCell>
                    <Input value={p.role || ""} onChange={(e) => updatePerson(p.id, "role", e.target.value)} className="h-8" disabled={!editable} />
                  </TableCell>
                  <TableCell>
                    <Input type="email" value={p.email || ""} onChange={(e) => updatePerson(p.id, "email", e.target.value)} className="h-8" disabled={!editable} />
                  </TableCell>
                  <TableCell>
                    <Input value={p.contact_number || ""} onChange={(e) => updatePerson(p.id, "contact_number", e.target.value)} className="h-8" disabled={!editable} />
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deletePerson(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
