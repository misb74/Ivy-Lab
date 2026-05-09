export const CONNECTOR_RELIABILITY_POLICY = [
    {
        tool_name: 'role_decompose',
        classification: 'required',
        timeout_ms: 15000,
        retries: 2,
        fallback: 'Fail simulation with clear error',
    },
    {
        tool_name: 'workbank_occupation_automation',
        classification: 'required',
        timeout_ms: 10000,
        retries: 2,
        fallback: 'Fail: no simulation without desire/capability data',
    },
    {
        tool_name: 'aei_task_penetration',
        classification: 'required',
        timeout_ms: 15000,
        retries: 2,
        fallback: 'Fail: no simulation without empirical AI usage',
    },
    {
        tool_name: 'bls_occupation_wages',
        classification: 'optional',
        timeout_ms: 10000,
        retries: 1,
        fallback: 'Use O*NET median wage estimate; flag as degraded',
    },
    {
        tool_name: 'atlas_get_occupation',
        classification: 'optional',
        timeout_ms: 10000,
        retries: 1,
        fallback: 'Use direct Lightcast/O*NET skill tools; flag as degraded',
    },
    {
        tool_name: 'lightcast_search_skills',
        classification: 'optional',
        timeout_ms: 10000,
        retries: 1,
        fallback: 'Use O*NET skills only; flag as degraded',
    },
    {
        tool_name: 'aioe_occupation_exposure',
        classification: 'optional',
        timeout_ms: 10000,
        retries: 1,
        fallback: 'Use AEI + WorkBank only for exposure; flag as degraded',
    },
    {
        tool_name: 'jobhop_transition_probability',
        classification: 'optional',
        timeout_ms: 10000,
        retries: 1,
        fallback: 'Skip career transition data; flag in transition plan',
    },
    {
        tool_name: 'workbank_gap_analysis',
        classification: 'required',
        timeout_ms: 10000,
        retries: 2,
        fallback: 'Fail: no simulation without desire-capability gap data',
    },
    {
        tool_name: 'workbank_human_edge',
        classification: 'required',
        timeout_ms: 10000,
        retries: 2,
        fallback: 'Fail: no simulation without human-edge dimensions',
    },
    {
        tool_name: 'aei_task_collaboration',
        classification: 'required',
        timeout_ms: 15000,
        retries: 2,
        fallback: 'Fail: no simulation without collaboration patterns',
    },
];
export async function hydrateRoleWithPolicy(input) {
    const execute = input.execute ?? buildUnavailableExecutor();
    const payloads = buildPayloads(input);
    const source_status = [];
    const source_results = {};
    const degraded_sources = [];
    const required_failures = [];
    const edge_policy = CONNECTOR_RELIABILITY_POLICY.find((policy) => policy.tool_name === 'workbank_human_edge');
    const base_policies = CONNECTOR_RELIABILITY_POLICY.filter((policy) => policy.tool_name !== 'workbank_human_edge');
    const settled = await Promise.allSettled(base_policies.map(async (policy) => {
        const attemptResult = await runWithRetries(() => runWithTimeout(execute(policy.tool_name, payloads[policy.tool_name] ?? {}), policy.timeout_ms, policy.tool_name), policy.retries);
        return {
            policy,
            attempts: attemptResult.attempts,
            value: attemptResult.value,
        };
    }));
    settled.forEach((result, index) => {
        const policy = base_policies[index];
        if (result.status === 'fulfilled') {
            source_results[policy.tool_name] = result.value.value;
            source_status.push({
                tool_name: policy.tool_name,
                status: 'ok',
                attempts: result.value.attempts,
            });
            return;
        }
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        if (policy.classification === 'required') {
            required_failures.push(`${policy.tool_name}: ${error}`);
            source_status.push({
                tool_name: policy.tool_name,
                status: 'failed',
                attempts: policy.retries + 1,
                error,
            });
            return;
        }
        degraded_sources.push(policy.tool_name);
        source_status.push({
            tool_name: policy.tool_name,
            status: 'degraded',
            attempts: policy.retries + 1,
            error,
        });
    });
    if (required_failures.length > 0) {
        throw new Error(`Hydration aborted due to required connector failures: ${required_failures.join('; ')}`);
    }
    const human_edge_collection = edge_policy
        ? await collectHumanEdgeSignals({
            tasks: buildTaskSeeds(source_results),
            policy: edge_policy,
            execute,
        })
        : { signals: new Map(), success_count: 0, total_count: 0 };
    const human_edge_signals = human_edge_collection.signals;
    if (edge_policy) {
        if (human_edge_collection.success_count === 0) {
            throw new Error('Hydration aborted due to required connector failures: workbank_human_edge returned no usable task signals');
        }
        const degraded = human_edge_collection.success_count < human_edge_collection.total_count;
        if (degraded) {
            degraded_sources.push(edge_policy.tool_name);
        }
        source_status.push({
            tool_name: edge_policy.tool_name,
            status: degraded ? 'degraded' : 'ok',
            attempts: edge_policy.retries + 1,
            error: degraded
                ? `Collected ${human_edge_collection.success_count}/${human_edge_collection.total_count} task-level human-edge signals`
                : undefined,
        });
    }
    const tasks = mergeTaskSignals(source_results, human_edge_signals);
    const worker_desire_avg = average(tasks.map((task) => task.worker_desire_score));
    const automation_potential = average(tasks.map((task) => task.ai_capability_score));
    const human_edge_avg = average(tasks.map((task) => (task.human_edge_stakeholder_trust +
        task.human_edge_social_intelligence +
        task.human_edge_creativity +
        task.human_edge_ethics +
        task.human_edge_physical_presence +
        task.human_edge_judgment) /
        6));
    return {
        automation_potential,
        worker_desire_avg,
        aei_exposure_score: deriveAeiExposure(source_results, tasks),
        felten_aioe_score: deriveFeltenExposure(source_results),
        human_edge_avg,
        annual_cost_per_fte: deriveAnnualCost(source_results),
        skills: getSkillRecords(source_results, input.onet_soc_code),
        tasks,
        task_skill_provenance: getTaskSkillProvenance(source_results),
        degraded_sources,
        source_versions: {
            onet: 'v30.2',
            aei: '2026-01-15',
            workbank: '2025-Q4',
            bls: '2025-12',
            lightcast: '2026-01',
            felten_aioe: '2025-Q4',
            jobhop: '2025-Q4',
        },
        source_status,
    };
}
function mergeTaskSignals(source_results, human_edge_by_statement) {
    const seeds = buildTaskSeeds(source_results);
    const signal_store = buildTaskSignalStore(source_results);
    return seeds.map((seed) => {
        const signals = resolveSignals(signal_store, seed);
        const edge = human_edge_by_statement.get(normalizeText(seed.task_statement));
        const ai_capability_score = normalizeUnitScale(signals.ai_capability_score, 0.45);
        const worker_desire_score = normalizeUnitScale(signals.worker_desire_score, 0.5);
        const aei_penetration_rate = normalizeUnitScale(signals.aei_penetration_rate, 0.4);
        const aei_autonomy = normalizeUnitScale(signals.aei_autonomy, Math.max(0.2, aei_penetration_rate * 0.85));
        return {
            onet_task_id: seed.onet_task_id,
            task_statement: seed.task_statement,
            importance: clamp01(seed.importance),
            time_allocation: clamp01(seed.time_allocation),
            ai_capability_score,
            worker_desire_score,
            human_agency_scale: normalizeUnitScale(edge?.human_agency_scale ?? signals.human_agency_scale, 1 - ai_capability_score),
            aei_penetration_rate,
            aei_autonomy,
            aei_collaboration_pattern: signals.aei_collaboration_pattern ?? 'human-in-loop',
            human_edge_stakeholder_trust: normalizeUnitScale(edge?.stakeholder_trust, 0.5),
            human_edge_social_intelligence: normalizeUnitScale(edge?.social_intelligence, 0.5),
            human_edge_creativity: normalizeUnitScale(edge?.creativity, 0.45),
            human_edge_ethics: normalizeUnitScale(edge?.ethics, 0.55),
            human_edge_physical_presence: normalizeUnitScale(edge?.physical_presence, 0.2),
            human_edge_judgment: normalizeUnitScale(edge?.judgment, 0.55),
        };
    });
}
function buildTaskSeeds(source_results) {
    const role_decompose = unwrapToolResult(source_results['role_decompose']);
    const payload = asObject(role_decompose);
    const task_rows = asArray(payload?.tasks) ?? [];
    const normalized = task_rows.map((row, index) => {
        const task = asObject(row) ?? {};
        const statement = String(task.task_statement ?? task.statement ?? task.task_description ?? task.name ?? `Task ${index + 1}`);
        const onet_task_id = parseTaskId(task.onet_task_id ?? task.task_id ?? task.id ?? statement, index);
        const importance = normalizeWeight(task.importance ?? task.level ?? (asObject(task.score)?.value ?? 0.6), 0.6);
        const time_allocation = normalizeWeight(task.time_allocation, -1);
        return { onet_task_id, task_statement: statement, importance, time_allocation };
    });
    if (normalized.length === 0) {
        const fallback_rows = extractWorkbankRows(source_results['workbank_occupation_automation']);
        return fallback_rows.map((row, index) => {
            const statement = String(row.task_statement ?? row.task_description ?? `Task ${index + 1}`);
            return {
                onet_task_id: parseTaskId(row.onet_task_id ?? row.task_id ?? statement, index),
                task_statement: statement,
                importance: 0.6,
                time_allocation: 1 / Math.max(fallback_rows.length, 1),
            };
        });
    }
    const explicit_total = normalized.reduce((sum, row) => sum + Math.max(0, row.time_allocation), 0);
    if (explicit_total <= 0) {
        const uniform = 1 / Math.max(normalized.length, 1);
        return normalized.map((row) => ({ ...row, time_allocation: uniform }));
    }
    return normalized.map((row) => ({
        ...row,
        time_allocation: clamp01(row.time_allocation / explicit_total),
    }));
}
function buildTaskSignalStore(source_results) {
    const by_id = new Map();
    const by_statement = new Map();
    const upsert = (row, patch) => {
        const parsed_id = parseTaskId(row.onet_task_id ?? row.task_id ?? row.id, -1);
        const statement = String(row.task_statement ?? row.statement ?? row.task_description ?? row.task ?? '').trim();
        if (parsed_id > 0) {
            const existing = by_id.get(parsed_id) ?? {};
            by_id.set(parsed_id, { ...existing, ...patch });
        }
        if (statement.length > 0) {
            const key = normalizeText(statement);
            const existing = by_statement.get(key) ?? {};
            by_statement.set(key, { ...existing, ...patch });
        }
    };
    for (const row of extractWorkbankRows(source_results['workbank_occupation_automation'])) {
        upsert(row, {
            ai_capability_score: asNumber(row.ai_capability_score),
            worker_desire_score: asNumber(row.worker_automation_desire ?? row.worker_desire_score ?? row.automation_desire),
            human_agency_scale: asNumber(row.human_agency_scale_worker ?? row.human_agency_scale),
        });
    }
    for (const row of extractGapRows(source_results['workbank_gap_analysis'])) {
        upsert(row, {
            worker_desire_score: asNumber(row.worker_automation_desire ?? row.worker_desire_score ?? row.automation_desire),
            ai_capability_score: asNumber(row.ai_capability_score),
            human_agency_scale: asNumber(row.human_agency_scale_worker ?? row.human_agency_scale),
        });
    }
    for (const row of extractAeiRows(source_results['aei_task_penetration'])) {
        upsert(row, {
            aei_penetration_rate: asNumber(row.penetration_rate ?? row.penetration),
            aei_autonomy: asNumber(row.autonomy ?? row.ai_autonomy),
        });
    }
    for (const row of extractAeiRows(source_results['aei_task_collaboration'])) {
        upsert(row, {
            aei_collaboration_pattern: String(row.collaboration_pattern ?? row.collaboration ?? row.pattern ?? 'human-in-loop'),
            aei_autonomy: asNumber(row.autonomy ?? row.ai_autonomy),
        });
    }
    return { by_id, by_statement };
}
function resolveSignals(signal_store, seed) {
    const by_id = signal_store.by_id.get(seed.onet_task_id) ?? {};
    const by_statement = signal_store.by_statement.get(normalizeText(seed.task_statement)) ?? {};
    return {
        ...by_statement,
        ...by_id,
    };
}
async function collectHumanEdgeSignals(input) {
    const by_statement = new Map();
    const settled = await Promise.allSettled(input.tasks.map(async (task) => {
        const result = await runWithRetries(() => runWithTimeout(input.execute('workbank_human_edge', { task_statement: task.task_statement }), input.policy.timeout_ms, 'workbank_human_edge'), input.policy.retries);
        return {
            task_statement: task.task_statement,
            payload: result.value,
        };
    }));
    for (const item of settled) {
        if (item.status !== 'fulfilled')
            continue;
        const signal = parseHumanEdgeSignal(item.value.payload);
        if (!signal)
            continue;
        by_statement.set(normalizeText(item.value.task_statement), signal);
    }
    return {
        signals: by_statement,
        success_count: by_statement.size,
        total_count: input.tasks.length,
    };
}
function parseHumanEdgeSignal(source) {
    const payload = asObject(unwrapToolResult(source));
    if (!payload)
        return null;
    return {
        stakeholder_trust: normalizeUnitScale(payload.stakeholder_trust ?? payload.human_edge_stakeholder_trust, 0.5),
        social_intelligence: normalizeUnitScale(payload.social_intelligence ?? payload.human_edge_social_intelligence, 0.5),
        creativity: normalizeUnitScale(payload.creative_thinking ?? payload.creativity ?? payload.human_edge_creativity, 0.45),
        ethics: normalizeUnitScale(payload.ethical_judgment ?? payload.ethics ?? payload.human_edge_ethics, 0.55),
        physical_presence: normalizeUnitScale(payload.physical_dexterity ?? payload.physical_presence ?? payload.human_edge_physical_presence, 0.2),
        judgment: normalizeUnitScale(payload.contextual_adaptation ?? payload.judgment ?? payload.human_edge_judgment, 0.55),
        human_agency_scale: normalizeUnitScale(payload.human_agency_scale, 0.5),
    };
}
function deriveAeiExposure(source_results, tasks) {
    const payload = asObject(unwrapToolResult(source_results['aei_task_penetration']));
    const direct = asNumber(payload?.exposure_score ?? payload?.aei_exposure_score);
    if (typeof direct === 'number' && Number.isFinite(direct)) {
        return normalizeUnitScale(direct, 0.56);
    }
    const derived = average(tasks.map((task) => task.aei_penetration_rate));
    return normalizeUnitScale(derived, 0.56);
}
function deriveFeltenExposure(source_results) {
    const payload = asObject(unwrapToolResult(source_results['aioe_occupation_exposure']));
    return normalizeUnitScale(payload?.aioe_score ?? payload?.exposure_score, 0.48);
}
function deriveAnnualCost(source_results) {
    const payload = asObject(unwrapToolResult(source_results['bls_occupation_wages']));
    const annual = asNumber(payload?.median_annual_wage
        ?? payload?.annual_median
        ?? payload?.annual_mean
        ?? payload?.annual_mean_wage);
    return typeof annual === 'number' && annual > 0 ? annual : 82000;
}
// Skills that are clearly noise when returned for non-technical SOC codes.
// Keyed by SOC prefix → set of skill name patterns (lowercase) to exclude.
const SKILL_NOISE_FILTERS = [
    {
        // HR, management, business roles — filter out industrial/engineering skills
        exclude_soc_prefixes: ['11-', '13-', '43-'],
        blocked_skills: new Set([
            'supervisory control and data acquisition (scada)',
            'scada',
            'programmable logic controller',
            'plc programming',
            'cnc programming',
            'industrial automation',
            'ladder logic',
        ]),
    },
];
function isNoiseSkill(skillName, socCode) {
    const lower = skillName.toLowerCase().trim();
    for (const filter of SKILL_NOISE_FILTERS) {
        if (filter.exclude_soc_prefixes.some((p) => socCode.startsWith(p))) {
            if (filter.blocked_skills.has(lower))
                return true;
        }
    }
    return false;
}
function getTaskSkillProvenance(source_results) {
    const atlas_payload = asObject(unwrapToolResult(source_results['atlas_get_occupation'])) ?? {};
    const provenance = atlas_payload.task_skill_provenance;
    if (provenance && typeof provenance === 'object' && !Array.isArray(provenance)) {
        return provenance;
    }
    return {};
}
function getSkillRecords(source_results, onet_soc_code) {
    const skill_map = new Map();
    const register = (skill_name, partial) => {
        const name = skill_name.trim();
        if (!name)
            return;
        const key = normalizeText(name);
        const existing = skill_map.get(key) ?? {
            skill_name: name,
            lightcast_skill_id: null,
            level: 0.65,
            importance: 0.65,
            trend: 0,
        };
        skill_map.set(key, {
            ...existing,
            ...partial,
            skill_name: existing.skill_name || name,
            lightcast_skill_id: partial?.lightcast_skill_id ?? existing.lightcast_skill_id,
            level: clamp01(partial?.level ?? existing.level),
            importance: clamp01(partial?.importance ?? existing.importance),
            trend: clampSigned(partial?.trend ?? existing.trend, -1, 1),
        });
    };
    const atlas_payload = asObject(unwrapToolResult(source_results['atlas_get_occupation'])) ?? {};
    const atlas_rows = extractSkillRows(atlas_payload.skills);
    for (const row of atlas_rows) {
        const record = asObject(row) ?? {};
        const skillId = String(record.skill_id ?? record.id ?? '').trim();
        const category = String(record.category ?? '').trim().toLowerCase();
        const lightcastSkillId = (category === 'lightcast'
            || skillId.startsWith('KS')
            || skillId.startsWith('ES')
            || skillId.startsWith('BGS')) ? skillId || null : null;
        register(String(record.skill_name ?? record.name ?? ''), {
            lightcast_skill_id: lightcastSkillId,
            level: normalizeWeight(record.level ?? record.importance, 0.65),
            importance: normalizeWeight(record.importance ?? record.level, 0.7),
            trend: normalizeTrend(record.trend ?? record.significance),
        });
    }
    // Atlas is the preferred source because it is already SOC-resolved against
    // curated ONET↔Lightcast mappings. Only fall back when Atlas is unavailable.
    const hasAtlasSkills = skill_map.size > 0;
    const lightcast_payload = unwrapToolResult(source_results['lightcast_search_skills']);
    const lightcast_rows = extractSkillRows(lightcast_payload);
    if (!hasAtlasSkills) {
        for (const row of lightcast_rows) {
            const record = asObject(row) ?? {};
            register(String(record.name ?? record.skill_name ?? ''), {
                lightcast_skill_id: record.id != null ? String(record.id) : null,
                level: normalizeWeight(record.level ?? record.confidence, 0.7),
                importance: normalizeWeight(record.importance ?? record.score, 0.7),
                trend: normalizeTrend(record.trend ?? record.significance),
            });
        }
    }
    const decompose_payload = asObject(unwrapToolResult(source_results['role_decompose'])) ?? {};
    const onet_rows = asArray(decompose_payload.skills_required) ?? [];
    if (!hasAtlasSkills && skill_map.size < 8) {
        for (const row of onet_rows) {
            const record = asObject(row) ?? {};
            register(String(record.name ?? ''), {
                level: normalizeWeight(record.level, 0.6),
                importance: normalizeWeight(record.level ?? record.importance, 0.6),
            });
        }
    }
    if (skill_map.size === 0) {
        const roleName = normalizeText(String(decompose_payload.role ?? ''));
        const fallbackSkills = getRoleSpecificFallbackSkills(roleName);
        fallbackSkills.forEach((name) => register(name));
    }
    let skills = Array.from(skill_map.values());
    if (onet_soc_code) {
        skills = skills.filter((s) => !isNoiseSkill(s.skill_name, onet_soc_code));
    }
    return skills
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 40);
}
function getRoleSpecificFallbackSkills(roleName) {
    const profileMap = [
        {
            match: /\bdata analyst|business intelligence|bi analyst\b/,
            skills: ['SQL', 'Data analysis', 'Data visualization', 'Statistical modeling', 'Dashboard development', 'Python', 'Business intelligence', 'Data storytelling'],
        },
        {
            match: /\bux designer|ui designer|product designer\b/,
            skills: ['User research', 'Wireframing', 'Interactive prototyping', 'Usability testing', 'Interaction design', 'Design systems', 'Information architecture', 'Visual communication'],
        },
        {
            match: /\bdevops|site reliability|sre\b/,
            skills: ['CI/CD pipelines', 'Infrastructure as code', 'Cloud operations', 'Container orchestration', 'Observability', 'Incident response', 'System reliability', 'Automation scripting'],
        },
        {
            match: /\bqa engineer|quality assurance\b/,
            skills: ['Test planning', 'Automated testing', 'Regression testing', 'Defect triage', 'Quality control', 'Test case design', 'API testing', 'Release validation'],
        },
        {
            match: /\bproduct manager\b/,
            skills: ['Product strategy', 'Roadmapping', 'Prioritization', 'User requirements', 'Stakeholder alignment', 'Go-to-market planning', 'Experiment design', 'Outcome measurement'],
        },
        {
            match: /\bmarketing|seo|social media|brand\b/,
            skills: ['Market analysis', 'Campaign planning', 'Content strategy', 'Search optimization', 'Performance analytics', 'Audience segmentation', 'Brand positioning', 'Channel optimization'],
        },
        {
            match: /\bsales engineer|account executive|sales representative|sales manager|business development\b/,
            skills: ['Solution selling', 'Pipeline management', 'Customer discovery', 'Negotiation', 'CRM proficiency', 'Value articulation', 'Forecasting', 'Account planning'],
        },
        {
            match: /\brecruiter|talent acquisition|hr|people|benefits|compensation|employee relations|hris\b/,
            skills: ['Talent sourcing', 'Employee relations', 'HR compliance', 'Workforce planning', 'Interviewing', 'Compensation analysis', 'Benefits administration', 'HR systems'],
        },
        {
            match: /\bfinance|accounting|controller|tax|payroll|treasury\b/,
            skills: ['Financial analysis', 'Reconciliation', 'Budget planning', 'Regulatory compliance', 'Forecasting', 'Reporting', 'Risk assessment', 'Process controls'],
        },
        {
            match: /\blegal|paralegal|contract\b/,
            skills: ['Contract review', 'Legal research', 'Regulatory interpretation', 'Document drafting', 'Risk mitigation', 'Policy governance', 'Case management', 'Stakeholder advisement'],
        },
        {
            match: /\blogistics|supply chain|warehouse|procurement|operations\b/,
            skills: ['Process optimization', 'Inventory management', 'Vendor coordination', 'Capacity planning', 'Operational analytics', 'Quality controls', 'Cross-functional coordination', 'KPI tracking'],
        },
    ];
    const profile = profileMap.find((entry) => entry.match.test(roleName));
    if (profile)
        return profile.skills;
    return ['Stakeholder communication', 'Process management', 'Data analysis'];
}
function extractWorkbankRows(source) {
    const payload = unwrapToolResult(source);
    const object_payload = asObject(payload);
    if (Array.isArray(payload)) {
        return payload.filter((row) => Boolean(asObject(row)));
    }
    if (!object_payload)
        return [];
    const candidates = asArray(object_payload.tasks)
        ?? asArray(object_payload.data)
        ?? [];
    return candidates.filter((row) => Boolean(asObject(row)));
}
function extractGapRows(source) {
    const payload = asObject(unwrapToolResult(source));
    if (!payload)
        return [];
    const arrays = [
        asArray(payload.tasks),
        asArray(payload.over_automation_risk),
        asArray(payload.unmet_automation_demand),
        asArray(payload.aligned_automation),
        asArray(payload.aligned_human),
    ].filter((rows) => Array.isArray(rows));
    return arrays.flat().filter((row) => Boolean(asObject(row)));
}
function extractAeiRows(source) {
    const payload = unwrapToolResult(source);
    if (Array.isArray(payload)) {
        return payload.filter((row) => Boolean(asObject(row)));
    }
    const object_payload = asObject(payload);
    if (!object_payload)
        return [];
    const rows = asArray(object_payload.data) ?? asArray(object_payload.tasks) ?? [];
    return rows.filter((row) => Boolean(asObject(row)));
}
function extractSkillRows(source) {
    if (Array.isArray(source)) {
        return source.filter((row) => Boolean(asObject(row)));
    }
    const payload = asObject(source);
    if (!payload)
        return [];
    const rows = asArray(payload.skills) ?? asArray(payload.data) ?? [];
    return rows.filter((row) => Boolean(asObject(row)));
}
function unwrapToolResult(source) {
    if (typeof source === 'string') {
        try {
            return JSON.parse(source);
        }
        catch {
            return source;
        }
    }
    const payload = asObject(source);
    const content = asArray(payload?.content);
    if (content && content.length > 0) {
        const first = asObject(content[0]);
        if (first && typeof first.text === 'string') {
            return unwrapToolResult(first.text);
        }
    }
    return source;
}
function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function asArray(value) {
    return Array.isArray(value) ? value : undefined;
}
function asNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}
function parseTaskId(value, fallback_index) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
        return Math.round(numeric);
    }
    const text = String(value ?? '').trim();
    if (!text)
        return fallback_index + 1;
    const digits = text.match(/\d+/g)?.join('');
    if (digits) {
        const parsed = Number(digits.slice(0, 9));
        if (Number.isFinite(parsed) && parsed > 0)
            return parsed;
    }
    return hashToRange(text, 10_000_000, 99_999_999);
}
function normalizeWeight(value, fallback) {
    if (typeof value === 'undefined' || value === null)
        return fallback;
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return fallback;
    if (numeric >= 0 && numeric <= 1)
        return numeric;
    if (numeric > 1 && numeric <= 10)
        return numeric / 10;
    return clamp01(numeric / 100);
}
function normalizeTrend(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return 0;
    if (numeric >= -1 && numeric <= 1)
        return numeric;
    if (numeric > 1 && numeric <= 5)
        return (numeric - 3) / 2;
    return clampSigned(numeric / 100, -1, 1);
}
function normalizeUnitScale(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return clamp01(fallback);
    if (numeric >= 0 && numeric <= 1)
        return numeric;
    if (numeric > 1 && numeric <= 5)
        return clamp01(numeric / 5);
    if (numeric > 5 && numeric <= 7)
        return clamp01(numeric / 7);
    if (numeric > 7 && numeric <= 100)
        return clamp01(numeric / 100);
    return clamp01(numeric);
}
function normalizeText(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function normalizeSocCode(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return '13-2011';
    return trimmed
        .replace(/[^\d\-\.]/g, '')
        .replace(/\.00$/, '')
        .replace(/\.$/, '');
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function clampSigned(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function average(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((acc, value) => acc + value, 0) / values.length;
}
async function runWithRetries(fn, retries) {
    let attempt = 0;
    let last_error;
    while (attempt <= retries) {
        try {
            const value = await fn();
            return {
                value,
                attempts: attempt + 1,
            };
        }
        catch (error) {
            last_error = error;
            attempt += 1;
        }
    }
    throw last_error;
}
function runWithTimeout(promise, timeout_ms, tool_name) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`${tool_name} timed out after ${timeout_ms}ms`));
        }, timeout_ms);
        promise
            .then((value) => {
            clearTimeout(timeout);
            resolve(value);
        })
            .catch((error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}
function buildPayloads(input) {
    return {
        role_decompose: { role: input.role_title, occupation_code: input.onet_soc_code },
        workbank_occupation_automation: { occupation_code: input.onet_soc_code, role: input.role_title },
        workbank_gap_analysis: { occupation_code: input.onet_soc_code, role: input.role_title },
        workbank_human_edge: { task_statement: input.role_title, role: input.role_title },
        aei_task_penetration: { occupation_code: input.onet_soc_code, role: input.role_title, limit: 200 },
        aei_task_collaboration: { occupation_code: input.onet_soc_code, role: input.role_title },
        bls_occupation_wages: { occupation_code: input.onet_soc_code },
        atlas_get_occupation: { soc_code: input.onet_soc_code },
        lightcast_search_skills: { query: input.role_title },
        aioe_occupation_exposure: { occupation_code: input.onet_soc_code },
        jobhop_transition_probability: { from_occupation: input.role_title, limit: 10 },
    };
}
function buildUnavailableExecutor() {
    return async (_toolName) => {
        throw new Error('No connector executor configured for hydrator');
    };
}
export function buildMockConnectorExecutor() {
    return async (toolName, payload) => {
        const soc = String(payload.occupation_code ?? payload.onet_soc_code ?? '13-2011.00');
        const taskBase = hashToRange(soc, 2000, 9999);
        const roleName = String(payload.role ?? payload.from_occupation ?? payload.query ?? 'Finance Specialist');
        // SOC-derived variation factor: different roles get different capability profiles
        const v = hashToFloat(soc);
        const socCode = normalizeSocCode(soc);
        const roleLabel = roleName.toLowerCase();
        // SOC + title keyed profiles to prevent repeated generic task maps across finance roles.
        const SOC_PROFILES = {
            '43-3031': {
                tasks: [
                    'Process supplier invoices and 3-way match exceptions',
                    'Resolve vendor statement discrepancies',
                    'Prepare payment runs and release controls',
                    'Manage AP aging and escalation queues',
                ],
                caps: [0.84, 0.74, 0.72, 0.66],
                desires: [0.72, 0.64, 0.62, 0.55],
                trust: [0.2, 0.24, 0.28, 0.32],
                social: [0.14, 0.2, 0.22, 0.26],
            },
            '13-2011': {
                tasks: [
                    'Prepare journal entries and maintain general ledger accuracy',
                    'Execute month-end close checklists and reconciliations',
                    'Investigate account variances and supporting schedules',
                    'Coordinate audit-ready workpapers and documentation',
                ],
                caps: [0.66, 0.58, 0.49, 0.42],
                desires: [0.55, 0.47, 0.42, 0.35],
                trust: [0.35, 0.4, 0.5, 0.58],
                social: [0.3, 0.34, 0.4, 0.44],
            },
            '13-2051': {
                tasks: [
                    'Build forecasting and valuation models',
                    'Produce management performance dashboards',
                    'Run scenario planning and sensitivity analysis',
                    'Present decision support insights to business leaders',
                ],
                caps: [0.56, 0.6, 0.54, 0.34],
                desires: [0.62, 0.56, 0.58, 0.3],
                trust: [0.4, 0.35, 0.45, 0.72],
                social: [0.34, 0.3, 0.38, 0.68],
            },
            '11-3031': {
                tasks: [
                    'Set controllership policies and governance standards',
                    'Approve period close and statement integrity',
                    'Lead regulatory compliance and escalation decisions',
                    'Coach accounting managers on control effectiveness',
                ],
                caps: [0.33, 0.3, 0.24, 0.2],
                desires: [0.24, 0.2, 0.16, 0.14],
                trust: [0.82, 0.78, 0.86, 0.88],
                social: [0.68, 0.72, 0.8, 0.82],
            },
            '13-2082': {
                tasks: [
                    'Prepare tax filings and statutory disclosures',
                    'Research rule changes and compliance exposure',
                    'Model tax optimization scenarios',
                    'Advise finance and legal on transaction tax impact',
                ],
                caps: [0.62, 0.52, 0.46, 0.32],
                desires: [0.55, 0.54, 0.52, 0.3],
                trust: [0.55, 0.58, 0.5, 0.66],
                social: [0.34, 0.38, 0.4, 0.6],
            },
            '43-3051': {
                tasks: [
                    'Run payroll calculations and gross-to-net processing',
                    'Resolve payroll exceptions and employee queries',
                    'Manage payroll compliance submissions',
                    'Validate pay-cycle controls and audit trails',
                ],
                caps: [0.8, 0.72, 0.58, 0.52],
                desires: [0.3, 0.28, 0.24, 0.22],
                trust: [0.64, 0.62, 0.7, 0.72],
                social: [0.45, 0.42, 0.5, 0.52],
            },
            '13-2011.01': {
                tasks: [
                    'Plan and execute internal audit programs',
                    'Test controls and document deficiencies',
                    'Quantify risk exposure and remediation priority',
                    'Report findings to audit committee stakeholders',
                ],
                caps: [0.5, 0.44, 0.36, 0.3],
                desires: [0.45, 0.4, 0.32, 0.26],
                trust: [0.72, 0.68, 0.76, 0.8],
                social: [0.54, 0.5, 0.66, 0.72],
            },
            '13-2051.01': {
                tasks: [
                    'Develop integrated budget and rolling forecast cycles',
                    'Run variance diagnostics across business units',
                    'Prepare board-facing planning narratives',
                    'Stress test downside and upside business scenarios',
                ],
                caps: [0.58, 0.56, 0.42, 0.5],
                desires: [0.6, 0.58, 0.4, 0.55],
                trust: [0.4, 0.34, 0.72, 0.48],
                social: [0.35, 0.32, 0.7, 0.44],
            },
        };
        const TITLE_PROFILES = [
            // ── Finance ─────────────────────────────────
            { match: /\baccounts?\s+receivable|\bar\s+clerk\b/, profile: SOC_PROFILES['43-3031'] },
            { match: /\baccounts?\s+payable|\bap\s+clerk\b/, profile: SOC_PROFILES['43-3031'] },
            { match: /\bpayroll\b/, profile: SOC_PROFILES['43-3051'] },
            { match: /\bfp&a\b|\bplanning\b/, profile: SOC_PROFILES['13-2051.01'] },
            { match: /\bcontroller\b/, profile: SOC_PROFILES['11-3031'] },
            { match: /\btax\b/, profile: SOC_PROFILES['13-2082'] },
            { match: /\bauditor|audit\b/, profile: SOC_PROFILES['13-2011.01'] },
            { match: /\bfinancial analyst|finance analyst\b/, profile: SOC_PROFILES['13-2051'] },
            { match: /\baccountant\b/, profile: SOC_PROFILES['13-2011'] },
            { match: /\bbilling\b|\bcollection/,
                profile: { tasks: ['Process billing cycles and generate invoices', 'Resolve billing disputes and adjustments', 'Track collection aging and escalate overdue', 'Reconcile payment postings and customer accounts'], caps: [0.82, 0.68, 0.56, 0.72], desires: [0.7, 0.58, 0.42, 0.62], trust: [0.2, 0.32, 0.48, 0.28], social: [0.18, 0.34, 0.52, 0.24] } },
            { match: /\btreasury\b/,
                profile: { tasks: ['Manage daily cash positioning and forecasts', 'Execute FX hedging and investment strategies', 'Monitor bank covenants and credit facilities', 'Optimize working capital across entities'], caps: [0.62, 0.48, 0.36, 0.44], desires: [0.58, 0.52, 0.3, 0.48], trust: [0.52, 0.62, 0.74, 0.56], social: [0.36, 0.48, 0.58, 0.42] } },
            { match: /\bfinance manager\b/,
                profile: { tasks: ['Set financial strategy and resource allocation', 'Review and approve financial reports', 'Lead team performance and capability development', 'Interface with C-suite on financial outlook'], caps: [0.28, 0.38, 0.22, 0.18], desires: [0.22, 0.32, 0.18, 0.14], trust: [0.84, 0.72, 0.88, 0.92], social: [0.76, 0.68, 0.84, 0.88] } },
            // ── IT ───────────────────────────────────────
            { match: /\bsoftware engineer|developer\b/,
                profile: { tasks: ['Design and implement application features', 'Write automated tests and CI pipelines', 'Review code and mentor junior engineers', 'Debug production issues and optimize performance'], caps: [0.72, 0.78, 0.32, 0.66], desires: [0.74, 0.8, 0.28, 0.68], trust: [0.28, 0.2, 0.72, 0.34], social: [0.22, 0.16, 0.64, 0.28] } },
            { match: /\bsenior software\b/,
                profile: { tasks: ['Architect system design and technical standards', 'Lead code reviews and design decisions', 'Mentor engineers and grow team capabilities', 'Drive technical strategy and vendor evaluations'], caps: [0.54, 0.62, 0.22, 0.46], desires: [0.56, 0.64, 0.2, 0.5], trust: [0.56, 0.44, 0.82, 0.58], social: [0.48, 0.38, 0.76, 0.52] } },
            { match: /\bit support|help desk|desktop support\b/,
                profile: { tasks: ['Resolve end-user technical issues via ticketing', 'Provision and configure hardware and software', 'Document solutions and update knowledge base', 'Escalate complex infrastructure problems'], caps: [0.86, 0.82, 0.74, 0.52], desires: [0.72, 0.7, 0.62, 0.44], trust: [0.18, 0.2, 0.26, 0.48], social: [0.24, 0.22, 0.28, 0.52] } },
            { match: /\bdata scientist|ml engineer\b/,
                profile: { tasks: ['Build and validate predictive models', 'Prepare and clean datasets for analysis', 'Deploy models to production pipelines', 'Communicate insights to business stakeholders'], caps: [0.58, 0.76, 0.64, 0.3], desires: [0.62, 0.78, 0.68, 0.28], trust: [0.42, 0.22, 0.32, 0.74], social: [0.34, 0.18, 0.26, 0.7] } },
            { match: /\bdata analyst\b/,
                profile: { tasks: ['Query databases and build analytical reports', 'Create dashboards and visualization tools', 'Identify trends and anomalies in business data', 'Support decision-making with quantitative analysis'], caps: [0.78, 0.72, 0.62, 0.38], desires: [0.74, 0.68, 0.6, 0.34], trust: [0.22, 0.26, 0.36, 0.64], social: [0.2, 0.22, 0.32, 0.58] } },
            { match: /\bdevops\b/,
                profile: { tasks: ['Build and maintain CI/CD pipeline infrastructure', 'Monitor system health and incident response', 'Automate infrastructure provisioning', 'Optimize cloud costs and resource utilization'], caps: [0.74, 0.68, 0.82, 0.7], desires: [0.78, 0.72, 0.84, 0.72], trust: [0.22, 0.32, 0.18, 0.28], social: [0.16, 0.26, 0.14, 0.22] } },
            { match: /\bsecurity analyst|cybersecurity\b/,
                profile: { tasks: ['Monitor security alerts and investigate incidents', 'Conduct vulnerability assessments and pen testing', 'Develop security policies and compliance controls', 'Train staff on security awareness and protocols'], caps: [0.64, 0.56, 0.38, 0.42], desires: [0.58, 0.5, 0.32, 0.38], trust: [0.56, 0.62, 0.74, 0.68], social: [0.38, 0.42, 0.56, 0.62] } },
            { match: /\bqa engineer|quality assurance\b/,
                profile: { tasks: ['Design and execute test plans and cases', 'Automate regression test suites', 'Report defects and validate fixes', 'Ensure release quality and sign-off criteria'], caps: [0.72, 0.82, 0.66, 0.48], desires: [0.68, 0.8, 0.62, 0.44], trust: [0.28, 0.18, 0.34, 0.54], social: [0.22, 0.14, 0.28, 0.48] } },
            { match: /\bproduct manager\b/,
                profile: { tasks: ['Define product roadmap and prioritize features', 'Gather customer feedback and market research', 'Write specifications and acceptance criteria', 'Coordinate cross-functional delivery'], caps: [0.34, 0.52, 0.48, 0.26], desires: [0.38, 0.56, 0.52, 0.24], trust: [0.72, 0.48, 0.52, 0.82], social: [0.68, 0.44, 0.48, 0.78] } },
            { match: /\bux designer|ui designer\b/,
                profile: { tasks: ['Conduct user research and usability testing', 'Design wireframes and interactive prototypes', 'Create design systems and component libraries', 'Collaborate with engineering on implementation'], caps: [0.42, 0.56, 0.48, 0.32], desires: [0.46, 0.6, 0.52, 0.3], trust: [0.58, 0.44, 0.52, 0.7], social: [0.62, 0.4, 0.48, 0.66] } },
            { match: /\bnetwork engineer\b/,
                profile: { tasks: ['Design and maintain network infrastructure', 'Configure firewalls, switches, and routers', 'Monitor network performance and troubleshoot', 'Plan capacity and upgrade network architecture'], caps: [0.58, 0.68, 0.62, 0.42], desires: [0.54, 0.64, 0.58, 0.38], trust: [0.42, 0.32, 0.38, 0.6], social: [0.28, 0.24, 0.3, 0.48] } },
            { match: /\bdatabase admin|dba\b/,
                profile: { tasks: ['Manage database performance and optimization', 'Execute backup and disaster recovery procedures', 'Design schemas and manage data migrations', 'Monitor query performance and index strategy'], caps: [0.7, 0.74, 0.56, 0.62], desires: [0.66, 0.72, 0.52, 0.58], trust: [0.3, 0.26, 0.44, 0.38], social: [0.2, 0.18, 0.34, 0.3] } },
            { match: /\bsystem.? admin/,
                profile: { tasks: ['Maintain server infrastructure and uptime', 'Manage user access and security policies', 'Automate routine maintenance tasks', 'Support application deployment and configuration'], caps: [0.72, 0.66, 0.78, 0.58], desires: [0.68, 0.62, 0.76, 0.54], trust: [0.28, 0.34, 0.22, 0.42], social: [0.22, 0.28, 0.18, 0.36] } },
            { match: /\btechnical writer\b/,
                profile: { tasks: ['Write technical documentation and user guides', 'Maintain API reference and changelog', 'Create onboarding materials and tutorials', 'Review and edit engineering specifications'], caps: [0.68, 0.62, 0.56, 0.44], desires: [0.64, 0.58, 0.52, 0.4], trust: [0.32, 0.38, 0.44, 0.56], social: [0.28, 0.34, 0.4, 0.52] } },
            { match: /\bit manager\b/,
                profile: { tasks: ['Set IT strategy and budget priorities', 'Manage vendor relationships and contracts', 'Lead team hiring and capability development', 'Report IT performance metrics to leadership'], caps: [0.3, 0.42, 0.2, 0.24], desires: [0.26, 0.38, 0.16, 0.2], trust: [0.82, 0.58, 0.88, 0.84], social: [0.78, 0.54, 0.84, 0.8] } },
            // ── HR ───────────────────────────────────────
            { match: /\bhr generalist|hr coordinator\b/,
                profile: { tasks: ['Process employee lifecycle transactions', 'Respond to HR policy and benefits inquiries', 'Coordinate onboarding and offboarding workflows', 'Maintain HRIS data accuracy and reporting'], caps: [0.76, 0.72, 0.68, 0.58], desires: [0.64, 0.6, 0.56, 0.48], trust: [0.28, 0.32, 0.36, 0.46], social: [0.34, 0.38, 0.42, 0.52] } },
            { match: /\brecruiter\b/,
                profile: { tasks: ['Source candidates and manage talent pipelines', 'Screen resumes and conduct initial interviews', 'Coordinate interview scheduling and logistics', 'Extend offers and manage candidate experience'], caps: [0.7, 0.74, 0.78, 0.42], desires: [0.62, 0.66, 0.7, 0.36], trust: [0.32, 0.28, 0.24, 0.62], social: [0.44, 0.42, 0.38, 0.72] } },
            { match: /\bhr manager|hr director|hr business partner\b/,
                profile: { tasks: ['Advise leaders on people strategy and org design', 'Drive employee engagement and retention programs', 'Manage complex employee relations cases', 'Lead workforce planning and succession initiatives'], caps: [0.24, 0.32, 0.2, 0.28], desires: [0.2, 0.28, 0.16, 0.24], trust: [0.86, 0.78, 0.9, 0.82], social: [0.82, 0.74, 0.88, 0.78] } },
            { match: /\bcompensation|benefits\b/,
                profile: { tasks: ['Analyze market compensation data and benchmarks', 'Administer benefits enrollment and vendor relations', 'Model total rewards scenarios and cost projections', 'Ensure pay equity and regulatory compliance'], caps: [0.66, 0.62, 0.56, 0.44], desires: [0.58, 0.54, 0.5, 0.38], trust: [0.42, 0.46, 0.52, 0.64], social: [0.3, 0.34, 0.38, 0.52] } },
            { match: /\bl&d|learning|training\b/,
                profile: { tasks: ['Design learning programs and curricula', 'Facilitate workshops and training sessions', 'Assess skill gaps and recommend interventions', 'Manage LMS platform and learning metrics'], caps: [0.52, 0.38, 0.48, 0.64], desires: [0.56, 0.34, 0.52, 0.6], trust: [0.54, 0.72, 0.56, 0.38], social: [0.62, 0.76, 0.6, 0.34] } },
            { match: /\bhris\b/,
                profile: { tasks: ['Configure and maintain HRIS platform', 'Build HR reports and analytics dashboards', 'Manage system integrations and data feeds', 'Support HR process automation initiatives'], caps: [0.74, 0.68, 0.72, 0.66], desires: [0.7, 0.64, 0.68, 0.62], trust: [0.26, 0.32, 0.28, 0.34], social: [0.2, 0.26, 0.22, 0.28] } },
            { match: /\bemployee relations\b/,
                profile: { tasks: ['Investigate workplace complaints and conflicts', 'Advise managers on disciplinary procedures', 'Ensure compliance with labor laws and policies', 'Mediate disputes and restore working relationships'], caps: [0.28, 0.34, 0.3, 0.18], desires: [0.22, 0.28, 0.24, 0.14], trust: [0.84, 0.78, 0.82, 0.92], social: [0.82, 0.76, 0.8, 0.9] } },
            { match: /\btalent acquisition manager\b/,
                profile: { tasks: ['Set recruiting strategy and employer brand', 'Manage recruiting team performance and budget', 'Optimize hiring funnel and time-to-fill metrics', 'Partner with business leaders on headcount planning'], caps: [0.32, 0.44, 0.38, 0.22], desires: [0.28, 0.4, 0.34, 0.18], trust: [0.76, 0.58, 0.64, 0.84], social: [0.72, 0.54, 0.6, 0.82] } },
            // ── Sales ────────────────────────────────────
            { match: /\bsales rep|sales representative\b/,
                profile: { tasks: ['Prospect and qualify new business opportunities', 'Deliver product demos and sales presentations', 'Negotiate contracts and close deals', 'Manage customer relationships and renewals'], caps: [0.52, 0.44, 0.28, 0.36], desires: [0.46, 0.38, 0.22, 0.3], trust: [0.54, 0.62, 0.82, 0.7], social: [0.64, 0.72, 0.86, 0.76] } },
            { match: /\baccount executive\b/,
                profile: { tasks: ['Manage enterprise account portfolios', 'Develop strategic account growth plans', 'Orchestrate multi-stakeholder deal cycles', 'Forecast pipeline and revenue commitments'], caps: [0.38, 0.42, 0.26, 0.48], desires: [0.34, 0.38, 0.22, 0.44], trust: [0.68, 0.64, 0.84, 0.56], social: [0.74, 0.7, 0.88, 0.62] } },
            { match: /\bsales manager|sales director|regional sales\b/,
                profile: { tasks: ['Set sales targets and territory strategies', 'Coach and develop sales team performance', 'Review pipeline health and forecast accuracy', 'Represent sales in cross-functional leadership'], caps: [0.26, 0.32, 0.36, 0.18], desires: [0.2, 0.26, 0.3, 0.14], trust: [0.84, 0.76, 0.72, 0.9], social: [0.82, 0.78, 0.74, 0.88] } },
            { match: /\bcustomer success\b/,
                profile: { tasks: ['Onboard new customers and ensure adoption', 'Monitor health scores and usage analytics', 'Conduct business reviews and renewal discussions', 'Escalate at-risk accounts and coordinate retention'], caps: [0.58, 0.66, 0.34, 0.46], desires: [0.52, 0.6, 0.28, 0.4], trust: [0.48, 0.38, 0.74, 0.58], social: [0.56, 0.42, 0.78, 0.64] } },
            { match: /\bbusiness development\b/,
                profile: { tasks: ['Research target markets and identify prospects', 'Conduct outbound outreach campaigns', 'Qualify leads and book discovery meetings', 'Track pipeline metrics and conversion rates'], caps: [0.64, 0.72, 0.56, 0.68], desires: [0.58, 0.66, 0.5, 0.62], trust: [0.36, 0.28, 0.48, 0.32], social: [0.44, 0.36, 0.56, 0.4] } },
            { match: /\bsales engineer\b/,
                profile: { tasks: ['Deliver technical product demonstrations', 'Architect solutions for customer requirements', 'Support RFP responses with technical content', 'Bridge engineering and sales communication'], caps: [0.46, 0.52, 0.56, 0.3], desires: [0.48, 0.54, 0.58, 0.28], trust: [0.58, 0.52, 0.48, 0.76], social: [0.54, 0.48, 0.44, 0.72] } },
            { match: /\bsales operations\b/,
                profile: { tasks: ['Maintain CRM data quality and reporting', 'Build sales analytics dashboards and forecasts', 'Administer sales tools and territory assignments', 'Optimize sales processes and compensation plans'], caps: [0.76, 0.72, 0.68, 0.58], desires: [0.72, 0.68, 0.64, 0.54], trust: [0.24, 0.28, 0.32, 0.42], social: [0.2, 0.24, 0.28, 0.38] } },
            // ── Operations ──────────────────────────────
            { match: /\boperations analyst\b/,
                profile: { tasks: ['Analyze operational KPIs and identify bottlenecks', 'Build process efficiency reports and dashboards', 'Model resource allocation and capacity scenarios', 'Support continuous improvement initiatives'], caps: [0.7, 0.68, 0.56, 0.42], desires: [0.66, 0.64, 0.52, 0.38], trust: [0.3, 0.32, 0.44, 0.6], social: [0.26, 0.28, 0.4, 0.56] } },
            { match: /\boperations manager\b/,
                profile: { tasks: ['Set operational strategy and performance targets', 'Manage cross-functional process execution', 'Lead team development and resource planning', 'Escalate operational risks to senior leadership'], caps: [0.28, 0.36, 0.2, 0.22], desires: [0.24, 0.32, 0.16, 0.18], trust: [0.82, 0.7, 0.88, 0.86], social: [0.78, 0.66, 0.84, 0.82] } },
            { match: /\bsupply chain|logistics|procurement|warehouse\b/,
                profile: { tasks: ['Coordinate supply chain operations and logistics', 'Manage vendor selection and purchase orders', 'Track inventory levels and fulfillment metrics', 'Optimize distribution routes and warehouse layout'], caps: [0.72, 0.66, 0.74, 0.6], desires: [0.66, 0.6, 0.7, 0.54], trust: [0.28, 0.34, 0.26, 0.4], social: [0.24, 0.3, 0.22, 0.36] } },
            { match: /\bproject manager|program manager\b/,
                profile: { tasks: ['Plan project scope, timeline, and resources', 'Facilitate team ceremonies and stakeholder updates', 'Track risks, dependencies, and delivery milestones', 'Manage budgets and vendor coordination'], caps: [0.54, 0.42, 0.48, 0.32], desires: [0.5, 0.38, 0.44, 0.28], trust: [0.5, 0.64, 0.56, 0.74], social: [0.56, 0.68, 0.6, 0.76] } },
            { match: /\bbusiness analyst\b/,
                profile: { tasks: ['Gather and document business requirements', 'Map current-state processes and pain points', 'Propose solution designs and evaluate trade-offs', 'Facilitate UAT and stakeholder sign-off'], caps: [0.62, 0.56, 0.44, 0.36], desires: [0.58, 0.52, 0.4, 0.32], trust: [0.38, 0.44, 0.58, 0.68], social: [0.42, 0.48, 0.62, 0.72] } },
            { match: /\bcompliance officer|compliance analyst\b/,
                profile: { tasks: ['Monitor regulatory changes and assess impact', 'Conduct compliance audits and risk assessments', 'Develop and maintain compliance policies', 'Train staff on regulatory requirements'], caps: [0.46, 0.4, 0.34, 0.32], desires: [0.42, 0.36, 0.3, 0.28], trust: [0.66, 0.7, 0.76, 0.78], social: [0.48, 0.52, 0.58, 0.62] } },
            { match: /\bprocess engineer|facilities\b/,
                profile: { tasks: ['Design and optimize operational processes', 'Implement lean and continuous improvement methods', 'Manage facility operations and maintenance', 'Coordinate vendor services and space planning'], caps: [0.58, 0.52, 0.64, 0.46], desires: [0.54, 0.48, 0.6, 0.42], trust: [0.42, 0.48, 0.36, 0.54], social: [0.38, 0.44, 0.32, 0.5] } },
            // ── Marketing ───────────────────────────────
            { match: /\bmarketing coordinator|marketing analyst\b/,
                profile: { tasks: ['Coordinate marketing campaigns and events', 'Track campaign performance and ROI metrics', 'Manage marketing calendar and content pipeline', 'Support market research and competitive analysis'], caps: [0.68, 0.72, 0.64, 0.56], desires: [0.64, 0.68, 0.6, 0.52], trust: [0.32, 0.28, 0.36, 0.44], social: [0.36, 0.32, 0.4, 0.48] } },
            { match: /\bmarketing manager|brand manager\b/,
                profile: { tasks: ['Set marketing strategy and brand positioning', 'Manage marketing budget and channel allocation', 'Lead creative briefs and campaign development', 'Report marketing impact to business leadership'], caps: [0.32, 0.42, 0.28, 0.22], desires: [0.28, 0.38, 0.24, 0.18], trust: [0.76, 0.62, 0.8, 0.86], social: [0.72, 0.58, 0.76, 0.82] } },
            { match: /\bcontent specialist|copywriter\b/,
                profile: { tasks: ['Write marketing copy and content assets', 'Edit and proofread marketing materials', 'Manage content calendar and publishing workflow', 'Optimize content for SEO and engagement'], caps: [0.72, 0.64, 0.7, 0.58], desires: [0.68, 0.6, 0.66, 0.54], trust: [0.28, 0.36, 0.3, 0.42], social: [0.32, 0.4, 0.34, 0.46] } },
            { match: /\bdigital marketing|seo\b/,
                profile: { tasks: ['Manage digital advertising campaigns', 'Optimize SEO strategy and keyword rankings', 'Analyze web analytics and conversion funnels', 'A/B test landing pages and ad creatives'], caps: [0.76, 0.74, 0.7, 0.66], desires: [0.74, 0.72, 0.68, 0.64], trust: [0.24, 0.26, 0.3, 0.34], social: [0.2, 0.22, 0.26, 0.3] } },
            { match: /\bgraphic designer\b/,
                profile: { tasks: ['Create visual designs for marketing assets', 'Develop brand guidelines and design systems', 'Produce social media graphics and presentations', 'Collaborate with marketing on campaign visuals'], caps: [0.54, 0.62, 0.48, 0.36], desires: [0.58, 0.66, 0.52, 0.34], trust: [0.46, 0.38, 0.52, 0.66], social: [0.42, 0.34, 0.48, 0.62] } },
            { match: /\bpr specialist|social media\b/,
                profile: { tasks: ['Manage media relations and press communications', 'Create and schedule social media content', 'Monitor brand sentiment and respond to mentions', 'Coordinate events and spokesperson preparation'], caps: [0.52, 0.66, 0.58, 0.34], desires: [0.48, 0.62, 0.54, 0.3], trust: [0.5, 0.36, 0.44, 0.72], social: [0.58, 0.44, 0.52, 0.76] } },
            // ── Legal ───────────────────────────────────
            { match: /\blegal counsel|attorney|lawyer\b/,
                profile: { tasks: ['Provide legal advice on business transactions', 'Draft and review contracts and agreements', 'Manage litigation and dispute resolution', 'Ensure regulatory compliance across jurisdictions'], caps: [0.38, 0.46, 0.22, 0.34], desires: [0.32, 0.4, 0.18, 0.28], trust: [0.78, 0.66, 0.88, 0.76], social: [0.62, 0.54, 0.72, 0.64] } },
            { match: /\bparalegal|legal assistant\b/,
                profile: { tasks: ['Prepare legal documents and filings', 'Conduct legal research and case analysis', 'Manage case files and court deadlines', 'Coordinate with external counsel and courts'], caps: [0.68, 0.62, 0.58, 0.54], desires: [0.62, 0.56, 0.52, 0.48], trust: [0.34, 0.4, 0.44, 0.48], social: [0.3, 0.36, 0.4, 0.44] } },
            { match: /\bcontract admin/,
                profile: { tasks: ['Process contract requests and approvals', 'Maintain contract database and renewal tracking', 'Extract key terms and flag non-standard clauses', 'Support vendor and customer contract negotiations'], caps: [0.72, 0.66, 0.6, 0.42], desires: [0.66, 0.6, 0.54, 0.36], trust: [0.3, 0.36, 0.42, 0.62], social: [0.26, 0.32, 0.38, 0.58] } },
            // ── Customer Service ─────────────────────────
            { match: /\bcustomer service rep/,
                profile: { tasks: ['Handle inbound customer inquiries and complaints', 'Process orders, returns, and account changes', 'Document interactions and update CRM records', 'Escalate complex issues to supervisors'], caps: [0.82, 0.78, 0.76, 0.52], desires: [0.68, 0.64, 0.62, 0.4], trust: [0.2, 0.24, 0.26, 0.52], social: [0.36, 0.38, 0.4, 0.62] } },
            { match: /\bsenior customer service\b/,
                profile: { tasks: ['Handle escalated and complex customer issues', 'Mentor junior representatives on procedures', 'Analyze service trends and recommend improvements', 'Manage VIP and high-priority accounts'], caps: [0.68, 0.54, 0.62, 0.4], desires: [0.58, 0.44, 0.52, 0.32], trust: [0.38, 0.56, 0.44, 0.66], social: [0.48, 0.62, 0.52, 0.72] } },
            { match: /\bcustomer service supervisor|call center manager\b/,
                profile: { tasks: ['Manage service team scheduling and performance', 'Set quality standards and SLA targets', 'Review escalated cases and authorize exceptions', 'Report service metrics to operations leadership'], caps: [0.34, 0.42, 0.28, 0.24], desires: [0.28, 0.36, 0.22, 0.18], trust: [0.76, 0.64, 0.8, 0.84], social: [0.72, 0.6, 0.76, 0.8] } },
            { match: /\bcustomer experience\b/,
                profile: { tasks: ['Map customer journeys and identify pain points', 'Design service improvements and track NPS', 'Analyze customer feedback and survey data', 'Partner with product teams on UX enhancements'], caps: [0.56, 0.62, 0.68, 0.38], desires: [0.52, 0.58, 0.64, 0.34], trust: [0.46, 0.4, 0.34, 0.68], social: [0.52, 0.46, 0.4, 0.72] } },
        ];
        const profileByTitle = TITLE_PROFILES.find((entry) => entry.match.test(roleLabel))?.profile;
        const profileBySoc = SOC_PROFILES[socCode] ?? SOC_PROFILES[`${socCode}.00`];
        const profile = profileByTitle ?? profileBySoc;
        const tasks = profile?.tasks ?? [
            'Perform role-specific operational work',
            'Analyze functional performance and explain drivers',
            'Coordinate stakeholder decisions and escalations',
            'Maintain compliance evidence and documentation',
        ];
        // Wider variation: ±0.15 on caps/desires so same-profile roles still differ meaningfully
        const caps = (profile?.caps ?? [0.5, 0.45, 0.38, 0.34]).map((value, idx) => clamp01(value + ((v - 0.5) * 0.15) + idx * 0.008));
        const desires = (profile?.desires ?? [0.5, 0.46, 0.4, 0.34]).map((value, idx) => clamp01(value + ((v - 0.5) * 0.12) - idx * 0.006));
        const trusts = (profile?.trust ?? [0.35, 0.4, 0.5, 0.6]).map((value, idx) => clamp01(value + ((v - 0.5) * 0.1) + idx * 0.005));
        const socials = (profile?.social ?? [0.3, 0.35, 0.42, 0.5]).map((value, idx) => clamp01(value + ((v - 0.5) * 0.08) + idx * 0.006));
        const taskRows = tasks.map((stmt, i) => ({
            task_id: String(taskBase + i),
            onet_task_id: taskBase + i,
            task_statement: stmt,
            importance: [0.9, 0.85, 0.8][i] ?? 0.75,
            time_allocation: [0.4, 0.35, 0.25][i] ?? 0.2,
        }));
        if (toolName === 'role_decompose') {
            return {
                role: roleName,
                tasks: taskRows,
                skills_required: [], // Lightcast is the primary skill source
            };
        }
        if (toolName === 'workbank_occupation_automation') {
            return {
                occupation_code: soc,
                tasks: caps.map((cap, i) => ({
                    task_id: String(taskBase + i),
                    task_statement: tasks[i],
                    ai_capability_score: cap,
                    worker_automation_desire: desires[i],
                    human_agency_scale_worker: 1 - cap * 0.6,
                })),
            };
        }
        if (toolName === 'workbank_gap_analysis') {
            const rows = caps.map((cap, i) => ({
                task_id: String(taskBase + i),
                task_statement: tasks[i],
                ai_capability_score: cap,
                worker_automation_desire: desires[i],
                human_agency_scale_worker: 1 - cap * 0.6,
            }));
            return {
                occupation_code: soc,
                over_automation_risk: rows.filter((row) => row.ai_capability_score >= 0.7 && row.worker_automation_desire < 0.4),
                unmet_automation_demand: rows.filter((row) => row.ai_capability_score < 0.45 && row.worker_automation_desire >= 0.6),
                aligned_automation: rows.filter((row) => row.ai_capability_score >= 0.6 && row.worker_automation_desire >= 0.55),
                aligned_human: rows.filter((row) => row.ai_capability_score < 0.5 && row.worker_automation_desire < 0.5),
            };
        }
        if (toolName === 'workbank_human_edge') {
            const requested = String(payload.task_statement ?? '').trim().toLowerCase();
            const idx = Math.max(0, tasks.findIndex((task) => task.toLowerCase() === requested));
            return {
                task_statement: payload.task_statement ?? tasks[idx],
                stakeholder_trust: trusts[idx] ?? 0.5,
                social_intelligence: socials[idx] ?? 0.45,
                creative_thinking: 0.2 + v * 0.3 + idx * 0.05,
                ethical_judgment: 0.3 + (trusts[idx] ?? 0.5) * 0.5,
                physical_dexterity: 0.1 + idx * 0.03,
                contextual_adaptation: 0.3 + (trusts[idx] ?? 0.5) * 0.4,
                human_agency_scale: 1 - (caps[idx] ?? 0.5) + 0.15,
            };
        }
        if (toolName === 'aei_task_penetration') {
            return {
                data: caps.map((cap, i) => ({
                    onet_task_id: String(taskBase + i),
                    task_description: tasks[i],
                    penetration_rate: cap * 0.8,
                    autonomy: cap >= 0.7 ? 0.7 : cap >= 0.45 ? 0.5 : 0.3,
                })),
            };
        }
        if (toolName === 'aei_task_collaboration') {
            return {
                data: caps.map((cap, i) => ({
                    onet_task_id: String(taskBase + i),
                    task_description: tasks[i],
                    collaboration_pattern: cap >= 0.7 ? 'agent-led' : cap >= 0.45 ? 'human-in-loop' : 'human-led',
                })),
            };
        }
        if (toolName === 'bls_occupation_wages') {
            return { median_annual_wage: 81400 };
        }
        if (toolName === 'atlas_get_occupation') {
            const atlasSkills = getRoleSpecificFallbackSkills(normalizeText(roleName)).map((skill, idx) => ({
                soc_code: socCode,
                skill_id: `KS-MOCK-${taskBase + idx}`,
                skill_name: skill,
                level: null,
                importance: Math.max(55, 100 - idx * 7),
                category: 'lightcast',
            }));
            return {
                occupation: { soc_code: socCode, title: roleName },
                skills: atlasSkills,
            };
        }
        if (toolName === 'lightcast_search_skills') {
            const skillsByRole = [
                // ── Finance ──
                { match: /\baccounts?\s+payable|\bap\b/, skills: ['Invoice processing', 'Vendor reconciliation', 'Payment controls', 'Exception handling', 'Accounts payable management', 'Purchase order matching', 'Cash disbursement', 'ERP navigation'] },
                { match: /\baccounts?\s+receivable|\bar\b/, skills: ['Collections management', 'Cash application', 'Dispute resolution', 'Customer account reconciliation', 'Credit analysis', 'Aging report management', 'Revenue recognition', 'Dunning processes'] },
                { match: /\bpayroll\b/, skills: ['Payroll operations', 'Tax withholding compliance', 'Employee query resolution', 'Audit trail validation', 'Multi-state payroll', 'Garnishment processing', 'Year-end reporting', 'Timekeeping systems'] },
                { match: /\bcontroller\b/, skills: ['Financial governance', 'Internal controls', 'Regulatory oversight', 'Policy stewardship', 'GAAP compliance', 'Audit management', 'Financial close management', 'SOX compliance'] },
                { match: /\bfp&a\b|\bplanning\b/, skills: ['Forecast modeling', 'Scenario planning', 'Executive communication', 'Business performance analysis', 'Budget management', 'Variance analysis', 'Financial storytelling', 'Driver-based modeling'] },
                { match: /\btax\b/, skills: ['Tax compliance', 'Regulatory research', 'Tax planning', 'Transaction advisory', 'Tax provision', 'Transfer pricing', 'Tax technology', 'Audit defense'] },
                { match: /\bauditor|audit\b/, skills: ['Audit execution', 'Control testing', 'Risk assessment', 'Remediation tracking', 'Internal audit planning', 'Compliance verification', 'Process documentation', 'Audit report writing'] },
                { match: /\bfinancial analyst|finance analyst\b/, skills: ['Financial modeling', 'Dashboard reporting', 'Sensitivity analysis', 'Business partnering', 'Data visualization', 'Excel proficiency', 'Capital budgeting', 'Investment analysis'] },
                { match: /\baccountant\b/, skills: ['General ledger management', 'Close operations', 'Variance analysis', 'Financial reporting', 'Journal entry preparation', 'Account reconciliation', 'Fixed asset accounting', 'Intercompany accounting'] },
                // ── HR ──
                { match: /\bhr generalist|hr coordinator\b/, skills: ['Employee lifecycle management', 'HRIS administration', 'Benefits administration', 'HR compliance', 'Onboarding coordination', 'Policy documentation', 'Employee record management', 'HR reporting'] },
                { match: /\brecruiter\b/, skills: ['Talent sourcing', 'Candidate screening', 'Applicant tracking systems', 'Interview coordination', 'Boolean search techniques', 'Offer negotiation', 'Employer branding', 'Pipeline management'] },
                { match: /\bhr manager|hr director|hr business partner\b/, skills: ['People strategy', 'Employee relations', 'Organizational development', 'Workforce planning', 'Change management', 'Performance management', 'Talent retention', 'Leadership coaching'] },
                { match: /\bcompensation|benefits\b/, skills: ['Compensation analysis', 'Benefits program management', 'Total rewards strategy', 'Pay equity analysis', 'Salary benchmarking', 'Job evaluation', 'Incentive plan design', 'Benefits vendor management'] },
                { match: /\bl&d|learning|training\b/, skills: ['Instructional design', 'Learning management systems', 'Training facilitation', 'Skills gap analysis', 'Curriculum development', 'E-learning design', 'Training needs assessment', 'Learning metrics'] },
                { match: /\bhris\b/, skills: ['HRIS configuration', 'HR analytics', 'Systems integration', 'Process automation', 'Data migration', 'Report building', 'Workflow design', 'User administration'] },
                { match: /\bemployee relations\b/, skills: ['Conflict resolution', 'Labor law compliance', 'Workplace investigation', 'Mediation', 'Grievance handling', 'Policy enforcement', 'Disciplinary procedures', 'Employee advocacy'] },
                { match: /\btalent acquisition manager\b/, skills: ['Recruiting strategy', 'Employer branding', 'Hiring funnel optimization', 'Headcount planning', 'Recruitment marketing', 'Diversity hiring', 'Vendor management', 'Workforce analytics'] },
                // ── Sales ──
                { match: /\bsales rep|sales representative\b/, skills: ['Prospecting', 'Sales presentations', 'Negotiation', 'CRM management', 'Lead qualification', 'Objection handling', 'Territory management', 'Relationship building'] },
                { match: /\baccount executive\b/, skills: ['Account management', 'Strategic selling', 'Deal orchestration', 'Revenue forecasting', 'Executive engagement', 'Solution selling', 'Contract negotiation', 'Customer retention'] },
                { match: /\bsales manager|sales director\b/, skills: ['Sales leadership', 'Pipeline management', 'Team coaching', 'Territory planning', 'Revenue operations', 'Incentive design', 'Sales forecasting', 'Go-to-market strategy'] },
                { match: /\bcustomer success\b/, skills: ['Customer retention', 'Account health monitoring', 'Onboarding management', 'Renewal management', 'Churn prevention', 'Customer advocacy', 'Success planning', 'Expansion revenue'] },
                // ── IT ──
                { match: /\bsoftware engineer|developer\b/, skills: ['Software development', 'Code review', 'System design', 'Testing automation', 'Version control', 'Debugging', 'API development', 'Technical documentation'] },
                { match: /\bdevops\b/, skills: ['CI/CD pipeline management', 'Infrastructure automation', 'Cloud operations', 'Incident response', 'Container orchestration', 'Monitoring and alerting', 'Configuration management', 'Release management'] },
                { match: /\bdata engineer|data analyst\b/, skills: ['Data pipeline development', 'SQL', 'Data visualization', 'Statistical analysis', 'ETL processes', 'Data modeling', 'Python programming', 'Business intelligence'] },
                { match: /\bit manager\b/, skills: ['IT strategy', 'Vendor management', 'IT governance', 'Budget management', 'Service delivery', 'Technology roadmapping', 'Team leadership', 'Security oversight'] },
                { match: /\bproduct manager\b/, skills: ['Product roadmapping', 'User research', 'Requirements analysis', 'Cross-functional leadership', 'Prioritization frameworks', 'Stakeholder management', 'Competitive analysis', 'Go-to-market planning'] },
                // ── Customer Service ──
                { match: /\bcustomer service|support representative\b/, skills: ['Customer communication', 'Issue resolution', 'Knowledge base management', 'Service quality assurance', 'Ticketing systems', 'Empathy and de-escalation', 'First-contact resolution', 'Multi-channel support'] },
                // ── Marketing ──
                { match: /\bmarketing\b/, skills: ['Campaign management', 'Content strategy', 'Marketing analytics', 'Brand management', 'Digital marketing', 'SEO and SEM', 'Marketing automation', 'Audience segmentation'] },
                // ── Operations ──
                { match: /\boperations|logistics\b/, skills: ['Process optimization', 'Supply chain management', 'Quality assurance', 'Resource planning', 'Lean methodology', 'Inventory management', 'Workflow automation', 'Vendor coordination'] },
                // ── Legal ──
                { match: /\blegal|paralegal|counsel\b/, skills: ['Contract management', 'Legal research', 'Regulatory compliance', 'Risk assessment', 'Litigation support', 'Corporate governance', 'Intellectual property', 'Legal drafting'] },
            ];
            const matched = skillsByRole.find((entry) => entry.match.test(roleLabel))?.skills
                ?? ['Stakeholder communication', 'Process management', 'Data analysis', 'Problem solving', 'Project coordination', 'Written communication', 'Critical thinking', 'Attention to detail'];
            return matched.map((name, idx) => ({
                id: `LC-${(taskBase + idx).toString().slice(0, 6)}`,
                name,
                confidence: clamp01(0.8 + idx * 0.04),
                significance: clamp01(0.9 + idx * 0.05) + 0.2,
            }));
        }
        if (toolName === 'aioe_occupation_exposure') {
            return { aioe_score: caps.reduce((a, b) => a + b, 0) / caps.length };
        }
        if (toolName === 'jobhop_transition_probability') {
            return {
                transitions: [
                    { target_role: 'Agent Operations Specialist', probability: 0.42 },
                    { target_role: 'Financial Systems Analyst', probability: 0.37 },
                ],
            };
        }
        return {};
    };
}
function hashToFloat(input) {
    return (hashToRange(input, 0, 1000) / 1000);
}
function hashToRange(input, min, max) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return min + (hash % (max - min + 1));
}
//# sourceMappingURL=role-hydrator.js.map