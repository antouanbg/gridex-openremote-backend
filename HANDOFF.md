# Handoff — GrideX OpenRemote backend

## Purpose

This file lists concrete work that is planned but deliberately not completed
in the repository. It complements the current-task checkpoint in
`CODEX_STATE.md`.

## Pending work

1. **Review and merge the configuration dependency chain**
   - The Edge-health ingestion change is draft PR #6 and is stacked on the
     configuration-completeness branch.
   - Merge the configuration and outbox PRs in dependency order before PR #6.

2. **Commission the private MQTT health pipeline**
   - Configure a private listener reachable only over the Site Router VPN.
   - Create per-site MQTT identities/ACLs outside Git, start the
     `edge-health` Compose profile and verify the subscription.
   - Do not enable a public MQTT listener and do not route OT/BESS networks.

3. **Bind real Site Assets during commissioning**
   - Set each site code and trusted OpenRemote Site Asset binding.
   - Verify that the worker projects `edgeGatewayStatus`, observed time and
     control-ready state to the intended Site Asset.

4. **Apply and validate migrations on the Windows 11 Docker host**
   - Back up the database and use a staging site first.
   - Apply migration `004_edge_gateway_health.sql`, confirm indexes and test
     stale/offline transitions in `/api/v1/sites/{siteId}/snapshot`.

5. **Implement remaining forecasting/optimisation runtime workers**
   - IBEX historical/day-ahead imports, two price forecasts, weather/sunrise,
     PV/load forecasts, 96×15-minute schedules and Strategy/Control Asset
     application remain separate production workers.
   - Preserve the no-sale-at-loss and battery-cost/equivalent-cycle rules;
     never bypass Edge safety limits.

6. **Add operational monitoring**
   - Alert on MQTT worker disconnects, stale gateways, failed OpenRemote
     projection and configuration outbox failures.
   - Keep audit logs free of credentials, tokens and electrical-control data
     beyond what is necessary for traceability.

## Completion evidence

- Draft PRs are reviewed and tests/checks pass.
- Private VPN-only MQTT health message reaches PostgreSQL, OpenRemote and the
  authorized `/snapshot` response on a staging site.
- No secrets, real addresses or customer inventory are committed.

## Next action

Review the stacked PR chain, then prepare a staging commissioning checklist
for the Site Router and private MQTT listener.
