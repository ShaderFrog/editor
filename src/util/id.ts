let counter = 0;
export const makeId = () => `${Date.now()}_${count()}`;
export const count = () => counter++;
