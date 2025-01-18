export type FindUserProps = {
  token?: string;
  email?: string;
  id: string;
};

export interface authTokenPayload {
  userId: string;
  exp: string;
  iat: string;
}
