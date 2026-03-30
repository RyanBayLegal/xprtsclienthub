import AuditLogPanel from "@/components/AuditLogPanel";

export default function AuditLogs() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Audit Logs</h1>
      <AuditLogPanel title="All System Activity" />
    </div>
  );
}
