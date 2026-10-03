BEGIN;
CREATE TABLE IF NOT EXISTS navigation_catalog (
  id text PRIMARY KEY,
  parent_id text REFERENCES navigation_catalog(id) DEFERRABLE INITIALLY DEFERRED,
  path text NOT NULL UNIQUE CHECK (path LIKE '/%' AND path NOT LIKE '//%'),
  label_key text NOT NULL,
  sort_order integer NOT NULL,
  requirement text NOT NULL CHECK (requirement IN ('public','admin','service','inventory','coming_soon')),
  service_code text REFERENCES service_catalog(code),
  revision integer NOT NULL DEFAULT 1
);
-- Metadata is presentation, never an independent grant or inventory registry.
INSERT INTO navigation_catalog(id,parent_id,path,label_key,sort_order,requirement,service_code) VALUES
('overview',NULL,'/','nav.overview',0,'public',NULL),
('sites',NULL,'/sites/','nav.sites',1,'public',NULL),
('assets',NULL,'/assets/','nav.assets',2,'inventory',NULL),
('battery','assets','/assets/battery/','nav.battery',3,'inventory',NULL),
('inverter','assets','/assets/inverter/','nav.inverter',4,'inventory',NULL),
('evse','assets','/assets/charging-station/','nav.evse',5,'inventory',NULL),
('loads','assets','/assets/loads/','nav.loads',6,'inventory',NULL),
('devices',NULL,'/infrastructure/','nav.devices',7,'public',NULL),
('services',NULL,'/services/','nav.services',8,'public',NULL),
('market','services','/services/day-ahead/','nav.market',9,'service','day_ahead'),
('visualisations','services','/services/visualisations/','nav.visualisations',10,'service','visualisations'),
('reports','services','/services/analysis/','nav.reports',11,'coming_soon',NULL),
('weather','services','/services/weather/','nav.weather',12,'coming_soon',NULL),
('forecast','services','/services/forecast/','nav.forecast',13,'coming_soon',NULL),
('modes',NULL,'/mode/','nav.modes',14,'public',NULL),
('automation','modes','/mode/logic/','nav.automation',15,'public',NULL),
('schedule','modes','/mode/schedule/','nav.schedule',16,'public',NULL),
('alarms','modes','/mode/alarm/','nav.alarms',17,'public',NULL),
('settings',NULL,'/settings/','nav.settings',18,'public',NULL),
('members','settings','/settings/users/','nav.members',19,'admin',NULL),
('plans','settings','/settings/subscription/','nav.plans',20,'admin',NULL),
('market-settings','settings','/settings/market/','nav.market-settings',21,'admin',NULL),
('settlement','market-settings','/settings/market/tariff/','nav.settlement',22,'admin',NULL),
('balance','market-settings','/settings/market/balancing/','nav.balance',23,'admin',NULL),
('profile','settings','/settings/profile/','nav.profile',24,'public',NULL),
('help','profile','/settings/profile/documentation/','nav.help',25,'public',NULL),
('about',NULL,'/about/','nav.about',26,'public',NULL)
ON CONFLICT (id) DO NOTHING;
COMMIT;
