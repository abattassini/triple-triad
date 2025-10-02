export type Card = {
  id: number;
  name: string;
  blueImagePath: string;
  redImagePath: string;
};

export const getCardById = (id: number) => Cards.find(card => card.id === id);

export const Cards = [
  {
    id: 0,
    name: 'Card back',
    blueImagePath: 'back.png',
    redImagePath: 'back.png',
  },  {
    id: 1,
    name: 'Squall',
    blueImagePath: 'squall.jpg',
    redImagePath: 'rsquall.jpg',
  },  {
    id: 2,
    name: 'Odin',
    blueImagePath: 'odin.jpg',
    redImagePath: 'rodin.jpg',
  },
  {
    id: 3,
    name: 'Alexander',
    blueImagePath: 'alexander.jpg',
    redImagePath: 'ralexander.jpg',
  },
  {
    id: 4,
    name: 'Angelo',
    blueImagePath: 'angelo.jpg',
    redImagePath: 'rangelo.jpg',
  },
  {
    id: 5,
    name: 'Edea',
    blueImagePath: 'edea.jpg',
    redImagePath: 'redea.jpg',
  },
  {
    id: 6,
    name: 'Ifrit',
    blueImagePath: 'ifrit.jpg',
    redImagePath: 'rifrit.jpg',
  },
  {
    id: 7,
    name: 'Jumbocactuar',
    blueImagePath: 'jumbocactuar.jpg',
    redImagePath: 'rjumbocactuar.jpg',
  },
  {
    id: 8,
    name: 'Laguna',
    blueImagePath: 'laguna.jpg',
    redImagePath: 'rlaguna.jpg',
  },
] as Array<Card>;
