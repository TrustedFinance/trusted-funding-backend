// utils/wallet.js
export const getTotalBalance = (wallets, rates) => {
  let total = 0;
  for (const [currency, amount] of wallets) {
    const rate = rates[currency] || 0;
    total += amount * rate;
  }
  return total;
};
