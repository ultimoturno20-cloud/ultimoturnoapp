export function isReadOnlyAdmin(roles: readonly string[] | undefined) {
  return Boolean(roles?.includes("admin_readonly"));
}

export function canReadAdmin(roles: readonly string[] | undefined) {
  return Boolean(roles?.includes("admin") || isReadOnlyAdmin(roles));
}
