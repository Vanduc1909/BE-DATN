export const roundMoney = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const addMoney = (...values: number[]) => {
  return roundMoney(values.reduce((sum, value) => sum + value, 0));
};

export const subtractMoney = (base: number, ...values: number[]) => {
  return roundMoney(base - values.reduce((sum, value) => sum + value, 0));
};
