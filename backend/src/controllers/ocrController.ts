import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Contact } from '../models/Contact.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { ContactType } from '../types/index.js';

export const analyzeDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let tempFilePath: string | null = null;
  
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No file uploaded' });
      return;
    }

    // Write buffer to temp file
    const ext = req.file.mimetype === 'application/pdf' ? '.pdf' : 
                req.file.mimetype.split('/')[1];
    tempFilePath = path.join(os.tmpdir(), `ocr_${Date.now()}.${ext}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Call Python script
    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'invoice_extractor.py');
    const command = `python "${scriptPath}" "${tempFilePath}"`;

    exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
      // Clean up file immediately after python process finishes
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (error) {
        console.error('Python OCR error:', stderr || error.message);
        res.status(500).json({ status: 'error', message: 'OCR processing failed.' });
        return;
      }

      try {
        // Parse the JSON output from Python
        let ocrResult;
        
        // Sometimes Python prints warnings before JSON. We need to find the JSON string.
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          ocrResult = JSON.parse(jsonMatch[0]);
        } else {
          res.status(500).json({ status: 'error', message: 'Invalid response from OCR engine.' });
          return;
        }

        if (ocrResult.status === 'error') {
          res.status(400).json(ocrResult);
          return;
        }

        // --- Database Matching Logic ---
        const matches: any = {
          customerFound: false,
          invoiceFound: false,
          customerMatchedId: null,
          invoiceMatchedId: null,
          outstandingAmount: null
        };

        const docType = ocrResult.document_type;
        const data = ocrResult.data || {};

        let searchName = '';
        if (docType === 'payment_receipt' && data.customer_name) {
          searchName = data.customer_name;
        } else if (docType === 'sales_invoice' && data.customer_or_vendor_name) {
          searchName = data.customer_or_vendor_name;
        } else if (docType === 'purchase_invoice' && data.customer_or_vendor_name) {
          searchName = data.customer_or_vendor_name;
        }

        if (searchName) {
          // Attempt to find customer/vendor
          const typeMatch = docType === 'purchase_invoice' ? ContactType.Vendor : ContactType.Customer;
          // Simple regex search, case insensitive
          const contact = await Contact.findOne({
            name: { $regex: new RegExp(`^${searchName}$`, 'i') },
            type: { $in: [typeMatch, ContactType.Both] }
          });
          
          if (contact) {
            matches.customerFound = true;
            matches.customerMatchedId = contact._id.toString();
          }
        }

        if (docType === 'payment_receipt' && data.invoice_reference) {
          const invoice = await CustomerInvoice.findOne({
            number: { $regex: new RegExp(`^${data.invoice_reference}$`, 'i') }
          });

          if (invoice) {
            matches.invoiceFound = true;
            matches.invoiceMatchedId = invoice._id.toString();
            matches.outstandingAmount = invoice.total - (invoice.amountPaid || 0);
          }
        }

        // Add matches to response
        ocrResult.matches = matches;
        
        // Add basic TS validation checking
        ocrResult.validation = {
          isValid: true,
          warnings: []
        };
        
        if (matches.invoiceFound && matches.outstandingAmount !== null && data.amount !== null) {
           if (data.amount > matches.outstandingAmount) {
              ocrResult.validation.isValid = false;
              ocrResult.validation.warnings.push(`Receipt amount (Rs. ${data.amount}) exceeds outstanding invoice balance (Rs. ${matches.outstandingAmount}).`);
           }
        }

        res.status(200).json(ocrResult);

      } catch (parseError) {
        console.error('Failed to parse Python output:', stdout);
        res.status(500).json({ status: 'error', message: 'Failed to parse AI response.' });
      }
    });

  } catch (error) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    next(error);
  }
};
