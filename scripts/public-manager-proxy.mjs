// Generate only the approved Manager surface; never proxy master bootstrap APIs.
// Генерира само одобрения Manager достъп; без proxy към master bootstrap API.
export function managerLocations(origin) {
  const u = new URL(origin);
  if (u.protocol !== 'https:' || u.origin !== origin || !/^[a-z0-9.-]+$/.test(u.hostname)) throw Error('Invalid public origin');
  const config = JSON.stringify({manager:{realm:'gridex',clientId:'openremote',managerUrl:origin,keycloakUrl:origin+'/auth',consoleAutoEnable:false}});
  const info = JSON.stringify({version:'1.30.0',authServerUrl:origin+'/auth'});
  const readonly = `limit_except GET { deny all; }\n            proxy_pass http://$manager_backend;`;
  return `
        # BEGIN GRIDEX PUBLIC MANAGER -- generated, realm and user permissions apply
        set $manager_backend manager:8080;
        location = /manager { return 302 /manager/?realm=gridex; }
        location /manager/ { ${readonly} }
        location /shared/ { ${readonly} }
        # Public synthetic bootstrap only: no master upstream or configuration data.
        location = /api/master/info {
            limit_except GET { deny all; }
            default_type application/json;
            return 200 '${info}';
        }
        location = /api/master/configuration/manager {
            limit_except GET { deny all; }
            default_type application/json;
            return 200 '${config}';
        }
        location = /api/gridex/asset/query {
            limit_except POST { deny all; }
            proxy_pass http://$manager_backend;
        }
        location ~ ^/api/gridex/(asset(/|$)|model(/|$)|map(/tile/[^/]+/[^/]+/[^/]+|/getCustomMapInfo)?$|realm/accessible$|user/(user|userRoles/openremote|userRealmRoles)$) {
            ${readonly}
        }
        location = /websocket/events {
            if ($http_origin != '${origin}') { return 403; }
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-Port 443;
            proxy_set_header X-Forwarded-For $remote_addr;
            proxy_set_header Forwarded '';
            proxy_read_timeout 300s;
            proxy_pass http://$manager_backend;
        }
        # END GRIDEX PUBLIC MANAGER
`;
}
export function addManager(config, origin) {
  if(config.includes('BEGIN GRIDEX PUBLIC MANAGER')) throw Error('Already configured; review rather than duplicate');
  const marker = '        location /auth/realms/gridex/ {';
  if(config.split(marker).length!==2 || !config.includes('server_name '+new URL(origin).hostname+';')) throw Error('Unexpected proxy layout');
  return config.replace(marker,managerLocations(origin)+marker);
}
