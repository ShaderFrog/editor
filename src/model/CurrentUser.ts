/**
 * Client-safe version of the user model
 */
export type CurrentUser = {
  id: string;
  isPro: boolean;
  name: string;
  image: string | null;
  email: string | null;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  allowMarketingEmails?: boolean;
};
