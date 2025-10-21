import cron from "node-cron"
import  processDueInvestments from '../services/payoutProcessor.js';

cron.schedule('*/5 * * * *', async ()=>{
  try{
    await processDueInvestments();
    console.log('Processed investments');
  }catch(err){
    console.error('payout job err', err);
  }
});