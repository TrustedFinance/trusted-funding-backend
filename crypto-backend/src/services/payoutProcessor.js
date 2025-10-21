import {Investment} from '../models/Investment.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

/**
 * Process all due investments — pay users their returns when end date passes.
 */
export default async function processDueInvestments() {
  try {
    const now = new Date();
    // Find all investments that are active and have reached end date
    const dueInvestments = await Investment.find({
      status: 'active',
      endAt: { $lte: now }
    });

    if (!dueInvestments.length) return console.log('No due investments found');

    for (const inv of dueInvestments) {
      const user = await User.findById(inv.user);
      if (!user) continue;

      // Credit user balance with payout
      user.balance += inv.payoutAmount;
      user.stats.totalEarned += inv.payoutAmount - inv.amount;
      await user.save();

      // Mark investment as completed
      inv.status = 'completed';
      await inv.save();

      // Log transaction
      await Transaction.create({
        user: user._id,
        type: 'payout',
        amount: inv.payoutAmount,
        currency: user.currency || 'USD',
        status: 'completed',
        reference: `PAYOUT-${inv._id}`
      });

      console.log(`✅ Processed payout for user ${user.email} — ${inv.payoutAmount}`);
    }
  } catch (err) {
    console.error('❌ Error processing due investments:', err.message);
  }
}
