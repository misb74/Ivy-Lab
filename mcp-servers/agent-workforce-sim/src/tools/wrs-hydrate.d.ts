import { type HydratedRoleTask } from '../hydrators/role-hydrator.js';
/**
 * Pre-fetched results keyed by tool name.
 * For `workbank_human_edge`, the value must be an array of per-task objects
 * each containing a `task_statement` field so the executor can look up by
 * normalized task statement.
 * `degraded_sources` is an optional list of source names that already failed
 * upstream and should be merged into the degraded set returned by hydration.
 */
export interface PrefetchedSources {
    role_decompose?: unknown;
    workbank_occupation_automation?: unknown;
    workbank_gap_analysis?: unknown;
    /** Array of per-task human-edge objects, each with a `task_statement` field. */
    workbank_human_edge?: unknown[];
    aei_task_penetration?: unknown;
    aei_task_collaboration?: unknown;
    bls_occupation_wages?: unknown;
    atlas_get_occupation?: unknown;
    lightcast_search_skills?: unknown;
    aioe_occupation_exposure?: unknown;
    jobhop_transition_probability?: unknown;
    /** Sources that failed upstream and should be reported as degraded. */
    degraded_sources?: string[];
    [key: string]: unknown;
}
export interface WrsHydrateInput {
    simulation_id: string;
    role_id?: string;
    use_mock_data?: boolean;
    prefetched_sources?: PrefetchedSources;
}
export declare function handleWrsHydrate(input: WrsHydrateInput): Promise<{
    simulation_id: string;
    roles_hydrated: number;
    role_ids: string[];
    total_tasks: number;
    degraded_sources: string[];
    hydrated_role_task_samples: (HydratedRoleTask & {
        role_id: string;
    })[];
    used_mock_data: boolean;
    generated_at: string;
}>;
//# sourceMappingURL=wrs-hydrate.d.ts.map