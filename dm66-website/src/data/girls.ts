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

// Legacy presentation helper; current recipient records come from the Excel JSON export.
export const girls: Girl[] = [];
