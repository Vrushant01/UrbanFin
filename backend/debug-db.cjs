const mongoose = require('mongoose');

const uri = 'mongodb+srv://rrempire29_db_user:Rudra8081@cluster0.pffmaj2.mongodb.net/urbanfin?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
  const Contact = mongoose.model('Contact', new mongoose.Schema({}, {strict: false}));
  const User = mongoose.model('User2', new mongoose.Schema({}, {strict: false}), 'users');
  const CI = mongoose.model('CI', new mongoose.Schema({}, {strict: false}), 'customerinvoices');

  // Find the user "Ananya Sharma Trading"
  const ananyaSharma = await User.find({name: {$regex: /ananya.*sharma/i}}).lean();
  console.log('=== Users matching "Ananya Sharma" ===');
  for (const u of ananyaSharma) {
    console.log('  UserID:', u._id.toString(), '| Name:', u.name, '| Email:', u.email, '| Role:', u.role, '| contactId:', u.contactId || 'NONE');
    
    if (u.contactId) {
      const contact = await Contact.findById(u.contactId).lean();
      console.log('  -> Linked Contact:', contact ? `${contact._id.toString()} | ${contact.name} | ${contact.type}` : 'NOT FOUND');
      
      // Check if any invoice has this contactId as customerId
      const invoices = await CI.find({customerId: u.contactId}).lean();
      console.log('  -> Invoices with this contactId:', invoices.length);
      for (const inv of invoices) {
        console.log('     ', inv.number, '| Status:', inv.status, '| payReq:', inv.paymentRequested);
      }
    }
  }

  // Also check: which contact name includes "Ananya Sharma"
  const contacts = await Contact.find({name: {$regex: /ananya.*sharma/i}}).lean();
  console.log('\n=== Contacts matching "Ananya Sharma" ===');
  for (const c of contacts) {
    console.log('  ContactID:', c._id.toString(), '| Name:', c.name, '| Type:', c.type, '| Email:', c.email);
    
    const invoices = await CI.find({customerId: c._id.toString()}).lean();
    console.log('  -> Invoices with this customerId:', invoices.length);
    for (const inv of invoices) {
      console.log('     ', inv.number, '| Status:', inv.status, '| payReq:', inv.paymentRequested);
    }
  }

  // What invoices have paymentRequested = true?
  const reqInvoices = await CI.find({paymentRequested: true}).lean();
  console.log('\n=== Invoices with paymentRequested=true ===');
  for (const inv of reqInvoices) {
    const cust = await Contact.findById(inv.customerId).lean();
    console.log('  Invoice:', inv.number, '| customerId:', inv.customerId, '| CustomerName:', cust?.name || 'NOT FOUND', '| Status:', inv.status);
    
    // Check if a User exists with contactId = inv.customerId
    const userForInvoice = await User.findOne({contactId: inv.customerId}).lean();
    console.log('  -> User with contactId:', userForInvoice ? `${userForInvoice.name} (${userForInvoice.email})` : 'NO USER LINKED');
  }

  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
