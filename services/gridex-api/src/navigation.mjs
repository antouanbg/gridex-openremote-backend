// Presentation state only. Each resource endpoint must enforce its own authority.
export function effectiveNavigation(rows, principal, memberships, grants) {
  const platform = principal.emailVerified === true && principal.permissions?.includes('platform:manage');
  const admin = platform || memberships.some(m => m.role === 'administrator');
  const organisations = new Set(memberships.map(m => m.organisationId));
  const services = new Set(grants.filter(g => organisations.has(g.organisationId)).map(g => g.code));
  return rows.map(row => {
    let state = 'available';
    if(row.requirement === 'admin' && !admin) state = 'denied';
    if(row.requirement === 'service' && !platform && !services.has(row.serviceCode)) state = 'denied';
    if(row.requirement === 'coming_soon') state = 'coming_soon';
    if(row.requirement === 'inventory') state = 'inventory_required';
    return {...row, state, visible: row.requirement !== 'admin' || Boolean(admin)};
  });
}
