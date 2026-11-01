/** The user context attached to `request.user` by the JWT guard. */
export interface AuthenticatedUser {
  id: string
  email: string
}
