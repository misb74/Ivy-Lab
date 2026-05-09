export type WorkvineReqStatus = "open" | "approved" | "decided" | "cancelled";

export interface WorkvineReq {
  id: string;
  tenant_id: string;
  role_id: string;
  status: WorkvineReqStatus;
  simulation_id?: string | null;
  created_at: string;
  updated_at: string;
  schema_version: "1.1.0";
}
