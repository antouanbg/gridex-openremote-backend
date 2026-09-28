// The reviewed public HTTPS template is the sole source for the protected
// Manager routes. Do not re-run the historical anonymous installer.
export function managerLocations() {
  throw new Error('Public Manager must be deployed from deploy/public-https/nginx.conf.template with portal launch enforcement');
}

export function addManager() {
  throw new Error('Legacy Manager installer is disabled; use the reviewed portal-launch template');
}
