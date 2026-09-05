import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.p0wvx.mongodb.net/urbanfin?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(uri);
  const Contact = mongoose.connection.collection('contacts');
  const SalesOrder = mongoose.connection.collection('salesorders');
  const CustomerInvoice = mongoose.connection.collection('customerinvoices');
  const VendorBill = mongoose.connection.collection('vendorbills');
  const Budget = mongoose.connection.collection('budgets');

  const totalContacts = await Contact.countDocuments();
  const customerCount = await Contact.countDocuments({ type: { $in: ['Customer', 'Both'] } });
  const vendorCount = await Contact.countDocuments({ type: { $in: ['Vendor', 'Both'] } });
  const soCount = await SalesOrder.countDocuments();
  const invCount = await CustomerInvoice.countDocuments();
  const billCount = await VendorBill.countDocuments();
  const budgetCount = await Budget.countDocuments();

  const distinctCustomersWithOrders = (await SalesOrder.distinct('customerId')).length;
  
  const returningAgg = await SalesOrder.aggregate([
    { $group: { _id: '$customerId', count: { $sum: 1 } } },
    { $match: { count: { $gte: 2 } } },
    { $count: 'returning' }
  ]).toArray();

  const sampleContacts = await Contact.find({}, { projection: { name: 1, type: 1 } }).limit(5).toArray();

  console.log('COUNTS:', JSON.stringify({
    totalContacts,
    customerCount,
    vendorCount,
    soCount,
    invCount,
    billCount,
    budgetCount,
    distinctCustomersWithOrders,
    returning: returningAgg[0]?.returning || 0,
    sampleContacts
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
