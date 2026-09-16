// Card art is served from the frontend's public folder (Vite base is `/triple-triad/`), so a catalogue-relative
// path like `ff8-deck/squall.jpg` becomes a URL the browser can load. Shared by the card tile and the shop.
export const cardArtUrl = (image: string) => `/triple-triad/images/cards/${image}`;
