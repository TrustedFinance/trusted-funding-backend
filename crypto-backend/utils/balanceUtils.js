import axios from "axios";
import User from "../src/models/User.js";

export async function creditBalance(userOrId, coin, amount) {
  const user = userOrId._id ? userOrId : await User.findById(userOrId);
  if (!user) throw new Error('User not found');

  const current = Number(user.balances.get(coin) || 0);
  user.balances.set(coin, current + Number(amount));

  await user.save();
  return user;
}

export async function debitBalance(userOrId, coin, amount) {
  const user = userOrId._id ? userOrId : await User.findById(userOrId);
  if (!user) throw new Error('User not found');

  const current = Number(user.balances.get(coin) || 0);
  if (current < amount) throw new Error(`Insufficient ${coin} balance`);

  user.balances.set(coin, current - Number(amount));

  await user.save();
  return user;
}
// ---------------- Fiat Equivalent ----------------

/**
 * Convert user's USDT-equivalent balance to their selected fiat currency
 * using the free open.er-api.com service (no API key required)
 */
// utils/balanceUtils.js
export async function getFiatBalance(user) {
  // If no fiat selected or USDT, just return current balance
  if (!user.currency || user.currency === 'USDT') return user.balance;

  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    const rate = res.data?.rates?.[user.currency.toUpperCase()] || 1;

    // Convert USDT (USD) balance to fiat — but don’t save it
    const fiatBalance = user.balance * rate;

    console.log(`💱 USD→${user.currency} rate: ${rate}, displayed balance: ${fiatBalance}`);
    return fiatBalance;
  } catch (err) {
    console.error('Error converting to fiat:', err.message);
    return user.balance; // fallback to current balance
  }
}


export async function getTopCoins(limit = 50) {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
      },
    });
    return res.data.map(c => c.symbol.toUpperCase());
  } catch (err) {
    console.error('Error fetching top coins:', err.message);
    // fallback to a static list
    return [
      'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'TON',
      'AVAX', 'LINK', 'DOT', 'MATIC', 'BCH', 'LTC', 'NEAR', 'UNI', 'XMR', 'ETC',
      'ICP', 'APT', 'FIL', 'STX', 'HBAR', 'VET', 'ARB', 'IMX', 'INJ', 'MKR',
      'OP', 'RUNE', 'QNT', 'SUI', 'AAVE', 'FTM', 'GRT', 'ALGO', 'FLOW', 'EGLD',
      'AXS', 'SNX', 'KAS', 'CFX', 'RPL', 'CHZ', 'CRV', 'MINA', 'PEPE', 'MANA'
    ];
  }
}