// Keep the public Keycloak surface limited to normal, slug-shaped realms.
// Ограничи публичния Keycloak до realm-и с допустим клиентски код.
export const oldRealmLocation = `        location /auth/realms/gridex/ {
            proxy_pass http://$auth_backend;
        }`;

export const customerRealmLocation = `        # Explicitly approved first customer realm; do not use a wildcard.
        # Изрично първият клиентски realm; без общ шаблон.
        location /auth/realms/novacom/ {
            proxy_pass http://$auth_backend;
        }`;

export function addCustomerRealms(config) {
  if (config.includes(customerRealmLocation)) throw Error('Customer realm route is already configured');
  if (config.split(oldRealmLocation).length !== 2) throw Error('Unexpected public auth route; inspect manually');
  if (config.split('server_name auth.gridex.tech;').length !== 2
      || !config.includes('location /auth/resources/ {')
      || !config.includes('location / { return 404; }'))
    throw Error('Unexpected public proxy layout');
  return config.replace(oldRealmLocation, `${oldRealmLocation}\n${customerRealmLocation}`);
}
