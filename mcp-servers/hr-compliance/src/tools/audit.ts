/**
 * Audit trail query and management.
 */

// ---------------------------------------------------------------------------
// Audit trail types and query
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  resource_type: string;
  resource_id: string;
  details: string;
  ip_address?: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface AuditQueryResult {
  query: {
    action?: string;
    date_range?: { start: string; end: string };
  };
  total_entries: number;
  entries: AuditEntry[];
  summary: AuditSummary;
  recommendations: string[];
}

export interface AuditSummary {
  total_actions: number;
  unique_actors: number;
  action_breakdown: Record<string, number>;
  risk_breakdown: Record<string, number>;
  most_active_actors: Array<{ actor: string; count: number }>;
  high_risk_actions: AuditEntry[];
}

/**
 * Generates a sample audit trail and query result framework.
 * In a production system, this would query an actual audit database.
 */
export function queryAuditTrail(
  action?: string,
  dateRange?: { start: string; end: string }
): AuditQueryResult {
  // Define known HR audit action categories
  const auditActions: Record<string, { description: string; risk: 'low' | 'medium' | 'high' }> = {
    'employee.create': { description: 'New employee record created', risk: 'low' },
    'employee.update': { description: 'Employee record updated', risk: 'low' },
    'employee.terminate': { description: 'Employee terminated', risk: 'high' },
    'employee.view_ssn': { description: 'SSN/sensitive data accessed', risk: 'high' },
    'employee.export': { description: 'Employee data exported', risk: 'high' },
    'compensation.update': { description: 'Compensation changed', risk: 'medium' },
    'compensation.approve': { description: 'Compensation change approved', risk: 'medium' },
    'benefits.enroll': { description: 'Benefits enrollment', risk: 'low' },
    'benefits.change': { description: 'Benefits changed', risk: 'low' },
    'leave.request': { description: 'Leave requested', risk: 'low' },
    'leave.approve': { description: 'Leave approved', risk: 'low' },
    'leave.deny': { description: 'Leave denied', risk: 'medium' },
    'access.grant': { description: 'System access granted', risk: 'medium' },
    'access.revoke': { description: 'System access revoked', risk: 'medium' },
    'access.failed_login': { description: 'Failed login attempt', risk: 'high' },
    'report.generate': { description: 'Report generated', risk: 'low' },
    'report.download': { description: 'Report downloaded', risk: 'medium' },
    'policy.update': { description: 'Policy updated', risk: 'medium' },
    'policy.approve': { description: 'Policy approved', risk: 'medium' },
    'investigation.open': { description: 'Investigation opened', risk: 'high' },
    'investigation.close': { description: 'Investigation closed', risk: 'high' },
    'discipline.issue': { description: 'Disciplinary action issued', risk: 'high' },
    'hiring.offer_extend': { description: 'Offer extended', risk: 'medium' },
    'hiring.offer_accept': { description: 'Offer accepted', risk: 'low' },
    'hiring.background_check': { description: 'Background check initiated', risk: 'medium' },
  };

  // Build framework response
  const matchedActions = action
    ? Object.entries(auditActions).filter(([key, _val]) =>
        key.toLowerCase().includes(action.toLowerCase()) ||
        _val.description.toLowerCase().includes(action.toLowerCase())
      )
    : Object.entries(auditActions);

  const entries: AuditEntry[] = matchedActions.map(([key, val], idx) => ({
    id: `audit-${(idx + 1).toString().padStart(6, '0')}`,
    timestamp: new Date().toISOString(),
    action: key,
    actor: 'system_query',
    resource_type: key.split('.')[0],
    resource_id: `${key.split('.')[0]}-sample`,
    details: val.description,
    risk_level: val.risk,
  }));

  // Build summary
  const actionBreakdown: Record<string, number> = {};
  const riskBreakdown: Record<string, number> = { low: 0, medium: 0, high: 0 };
  for (const entry of entries) {
    const category = entry.action.split('.')[0];
    actionBreakdown[category] = (actionBreakdown[category] || 0) + 1;
    riskBreakdown[entry.risk_level]++;
  }

  const highRiskActions = entries.filter(e => e.risk_level === 'high');

  const summary: AuditSummary = {
    total_actions: entries.length,
    unique_actors: 1,
    action_breakdown: actionBreakdown,
    risk_breakdown: riskBreakdown,
    most_active_actors: [{ actor: 'system_query', count: entries.length }],
    high_risk_actions: highRiskActions,
  };

  // Recommendations
  const recommendations: string[] = [];
  if (highRiskActions.length > 0) {
    recommendations.push(
      `${highRiskActions.length} high-risk action type(s) detected. Ensure these require multi-factor authentication and manager approval.`
    );
  }
  recommendations.push('Implement real-time alerting for high-risk actions (data exports, terminations, failed logins).');
  recommendations.push('Review audit logs at minimum monthly. Automate anomaly detection where possible.');
  recommendations.push('Ensure audit logs are tamper-proof and retained per your retention policy (typically 7 years for HR data).');
  if (dateRange) {
    recommendations.push(`Date range filter applied: ${dateRange.start} to ${dateRange.end}. Ensure complete coverage of audit period.`);
  }

  return {
    query: { action, date_range: dateRange },
    total_entries: entries.length,
    entries,
    summary,
    recommendations,
  };
}
