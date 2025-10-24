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
// Convert USDT balance to user's selected fiat currency
export async function getFiatBalance(user) {
  if (!user.currency || user.currency === 'USDT') {
    return user.balance; // already in USDT
  }

  try {
    // Use a free API like exchangerate.host
    const res = await axios.get(`https://api.exchangerate.host/convert`, {
      params: { from: 'USD', to: user.currency, amount: user.balance }
    });

    const fiatBalance = res.data?.result || 0;
    return fiatBalance;
  } catch (err) {
    console.error('Error converting to fiat:', err.message);
    return user.balance; // fallback to USDT
  }
}