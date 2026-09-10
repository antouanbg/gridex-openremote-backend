import { buildConfigurationProjection } from "./configuration-projection.mjs";

const errorText = (error) => String(error?.message || error || "Unknown error").slice(0, 1000);

export class ConfigurationOutboxWorker {
  constructor({ repository, openRemote, maximumAttempts = 8, leaseSeconds = 60, logger = console }) {
    this.repository = repository;
    this.openRemote = openRemote;
    this.maximumAttempts = maximumAttempts;
    this.leaseSeconds = leaseSeconds;
    this.logger = logger;
  }

  async processOnce() {
    const event = await this.repository.claimConfigurationOutbox(this.leaseSeconds);
    if (!event) return false;
    try {
      const context = await this.repository.getConfigurationWorkerContext(event.siteId, event.section);
      const operations = buildConfigurationProjection(event, context);
      for (const operation of operations) {
        for (const [name, value] of Object.entries(operation.attributes)) {
          await this.openRemote.writeManagedAttribute(operation.assetId, name, value);
        }
      }
      for (const operation of operations) {
        const asset = await this.openRemote.getManagedAsset(operation.assetId);
        const applied = Number(asset?.attributes?.gridexConfigurationRevision?.value);
        if (applied !== event.revision) throw new Error(`OpenRemote revision verification failed for Asset ${operation.assetId}.`);
      }
      await this.repository.completeConfigurationOutbox(event, operations.map((item) => item.assetId));
      this.logger.info?.("Configuration revision applied", { eventId:event.id, siteId:event.siteId, section:event.section, revision:event.revision });
    } catch (error) {
      await this.repository.failConfigurationOutbox(event, errorText(error), this.maximumAttempts);
      this.logger.error?.("Configuration revision failed", { eventId:event.id, siteId:event.siteId, section:event.section, revision:event.revision, error:errorText(error) });
    }
    return true;
  }
}
