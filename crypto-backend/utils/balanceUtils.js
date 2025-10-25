import axios from "axios";

// utils/balanceUtils.js
export async function creditBalance(user, coin, amount) {
  const current = Number(user.balances.get(coin) || 0);
  user.balances.set(coin, current + Number(amount));
  await user.save();
  return user;
}

export async function debitBalance(user, coin, amount) {
  const current = Number(user.balances.get(coin) || 0);
  if (current < amount) {
    throw new Error(`Insufficient ${coin} balance`);
  }
  user.balances.set(coin, current - Number(amount));
  await user.save();
  return user;
}

// ---------------- Fiat Equivalent ----------------

/**
 * Convert user's USDT-equivalent balance to their selected fiat currency
 * using the free open.er-api.com service (no API key required)
 */
export async function getFiatBalance(user) {
  // If no fiat selected or USDT, just return current balance
  if (!user.currency || user.currency === 'USDT') return user.balance;

  try {
    // Fetch latest USD → fiat exchange rates
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    const rate = res.data?.rates?.[user.currency.toUpperCase()] || 1;

    // Convert USDT (USD) balance to fiat
    const fiatBalance = user.balance * rate;

    // Store the converted balance in the user document
    user.balance = fiatBalance;
    await user.save();

    console.log(`💱 USD→${user.currency} rate: ${rate}, stored balance: ${fiatBalance}`);
    return fiatBalance;
  } catch (err) {
    console.error('Error converting to fiat:', err.message);
    return user.balance; // fallback to current balance
  }
}