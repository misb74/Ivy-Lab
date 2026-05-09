export type SourceClassification = 'required' | 'optional';
export interface ConnectorPolicy {
    tool_name: string;
    classification: SourceClassification;
    timeout_ms: number;
    retries: number;
    fallback: string;
}
export interface HydratedRoleTask {
    onet_task_id: number;
    task_statement: string;
    importance: number;
    time_allocation: number;
    ai_capability_score: number;
    worker_desire_score: number;
    human_agency_scale: number;
    aei_penetration_rate: number;
    aei_autonomy: number;
    aei_collaboration_pattern: string;
    human_edge_stakeholder_trust: number;
    human_edge_social_intelligence: number;
    human_edge_creativity: number;
    human_edge_ethics: number;
    human_edge_physical_presence: number;
    human_edge_judgment: number;
}
export interface HydratedRoleSkill {
    skill_name: string;
    lightcast_skill_id: string | null;
    level: number;
    importance: number;
    trend: number;
}
export interface HydratedRoleResult {
    automation_potential: number;
    worker_desire_avg: number;
    aei_exposure_score: number;
    felten_aioe_score: number;
    human_edge_avg: number;
    annual_cost_per_fte: number;
    skills: HydratedRoleSkill[];
    tasks: HydratedRoleTask[];
    task_skill_provenance: Record<string, Array<{
        skill_id: string;
        skill_name: string;
        similarity: number;
    }>>;
    degraded_sources: string[];
    source_versions: Record<string, string>;
    source_status: Array<{
        tool_name: string;
        status: 'ok' | 'failed' | 'degraded';
        attempts: number;
        error?: string;
    }>;
}
export type HydratorExecutor = (toolName: string, input: Record<string, unknown>) => Promise<unknown>;
export declare const CONNECTOR_RELIABILITY_POLICY: ConnectorPolicy[];
interface HydratorInput {
    role_title: string;
    onet_soc_code: string;
    execute?: HydratorExecutor;
}
export declare function hydrateRoleWithPolicy(input: HydratorInput): Promise<HydratedRoleResult>;
export declare function buildMockConnectorExecutor(): HydratorExecutor;
export {};
//# sourceMappingURL=role-hydrator.d.ts.map