export interface Girl {
  id: string;
  fullName: string;
  displayName: string;
  nicknames: string[];
  image: string;
  introduction: string;
  personality: string;
  memory?: string;
  wish: string;
  senderName?: string;
  isPlaceholder?: boolean;
}

// Private recipient profiles and wishes are returned only by an authenticated server session.
export const girls: Girl[] = [];
