// Roles del sistema y sus rutas permitidas
// admin: acceso total
// cajero: POS, pedidos online, caja, merma

export type Role = 'admin' | 'cajero'

// Rutas permitidas por rol (admin tiene acceso a todo)
const cajeroRoutes = ['/pos', '/pedidos', '/caja', '/merma']

// Página de inicio por rol
export const homeByRole: Record<string, string> = {
  admin: '/',
  cajero: '/pos',
}

export function getAllowedRoutes(role: string | undefined): string[] | 'all' {
  if (role === 'admin') return 'all'
  if (role === 'cajero') return cajeroRoutes
  return []
}

export function canAccessRoute(role: string | undefined, pathname: string): boolean {
  const allowed = getAllowedRoutes(role)
  if (allowed === 'all') return true
  return allowed.some(route => pathname === route || pathname.startsWith(route + '/'))
}

export function getHomePage(role: string | undefined): string {
  return homeByRole[role || ''] || '/menu'
}
