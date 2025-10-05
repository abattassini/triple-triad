// Card type definition for frontend use
// Note: Cards are now fetched from the backend API instead of being hardcoded here
export type Card = {
  id: number;
  name: string;
  blueImagePath: string;
  redImagePath: string;
};
