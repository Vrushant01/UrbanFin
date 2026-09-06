import os
import sys
import json
import fitz
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from dotenv import load_dotenv
from google import genai

load_dotenv()

def detect_file_type(file_path):
    ext = file_path.lower().split('.')[-1]
    if ext == 'pdf':
        return 'pdf'
    elif ext in ['png', 'jpg', 'jpeg', 'webp']:
        return 'image'
    return 'unknown'

def extract_text_from_pdf(pdf_path):
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        raise Exception(f"Failed to open PDF: {str(e)}")

    text = ""
    for page in doc:
        text += page.get_text() + "\n"

    # If useful text exists
    if len(text.strip()) >= 50:
        return text.strip(), False

    # Otherwise render to images and use Tesseract
    text = ""
    for page in doc:
        pixmap = page.get_pixmap(dpi=200)
        image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
        
        # Basic preprocessing
        image = image.convert('L') # Grayscale
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        text += pytesseract.image_to_string(image) + "\n"

    return text.strip(), True

def extract_text_from_image(image_path):
    try:
        image = Image.open(image_path)
    except Exception as e:
        raise Exception(f"Failed to open image: {str(e)}")
        
    # Image Preprocessing pipeline
    # 1. Convert to grayscale
    image = image.convert('L')
    # 2. Increase contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)
    # 3. Sharpening
    image = image.filter(ImageFilter.SHARPEN)
    
    text = pytesseract.image_to_string(image)
    return text.strip(), True

def extract_document_data(text):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY is missing in backend environment variables.")

    client = genai.Client(api_key=api_key)

    prompt = f"""
You are an accounting document extraction engine.

Read the supplied OCR text.
Determine whether it is a payment_receipt, sales_invoice, purchase_invoice, or unknown document.
Extract only information explicitly present.
Never invent missing information.
Return null for missing values.
Preserve exact financial amounts as numbers (or string if symbol is mixed). Try to output pure numbers if possible.
Recognize Indian formats such as: Rs., ₹, INR, Rupees
Recognize date formats including: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
Return valid JSON only.
Return confidence scores for the main extracted fields (e.g., between 0.0 and 1.0).
Do not perform database operations.
Do not create accounting transactions.
Your job is document understanding only.

If payment_receipt, output this JSON structure:
{{
    "document_type": "payment_receipt",
    "receipt": {{
        "source_receipt_number": null,
        "customer_name": null,
        "invoice_reference": null,
        "receipt_date": null,
        "amount": null,
        "payment_method": null,
        "transaction_reference": null,
        "memo": null
    }},
    "confidence": {{
        "customer_name": 0.0,
        "invoice_reference": 0.0,
        "receipt_date": 0.0,
        "amount": 0.0,
        "payment_method": 0.0
    }}
}}

If sales_invoice or purchase_invoice, output this structure:
{{
    "document_type": "sales_invoice", 
    "invoice": {{
        "invoice_number": null,
        "customer_or_vendor_name": null,
        "email": null,
        "phone": null,
        "address": null,
        "invoice_date": null,
        "due_date": null,
        "items": [
            {{
                "product_name": null,
                "quantity": null,
                "unit_price": null,
                "tax_rate": null,
                "tax_amount": null,
                "line_total": null
            }}
        ],
        "subtotal": null,
        "cgst": null,
        "sgst": null,
        "igst": null,
        "total_tax": null,
        "grand_total": null,
        "currency": null,
        "payment_method": null
    }},
    "confidence": {{
        "customer_or_vendor_name": 0.0,
        "invoice_number": 0.0,
        "grand_total": 0.0
    }}
}}

If unknown, output:
{{
    "document_type": "unknown",
    "confidence": {{}}
}}

OCR Text:
---
{text}
---
"""

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json"
        }
    )

    return json.loads(response.text)

def process_document(file_path):
    try:
        file_type = detect_file_type(file_path)
        
        if file_type == 'pdf':
            text, ocr_used = extract_text_from_pdf(file_path)
        elif file_type == 'image':
            text, ocr_used = extract_text_from_image(file_path)
        else:
            return {
                "status": "error",
                "message": "Unsupported file format. Must be PDF, PNG, JPG, JPEG, or WEBP."
            }

        if not text:
            return {
                "status": "error",
                "message": "Could not detect readable text from this file. Please upload a clearer image or PDF."
            }

        data = extract_document_data(text)

        # Basic financial validation could be placed here, or in TS backend
        # We'll just return it so Node can augment it with DB matches
        
        return {
            "status": "success",
            "document_type": data.get("document_type", "unknown"),
            "ocr_used": ocr_used,
            "raw_text": text,
            "data": data.get("receipt") if data.get("document_type") == "payment_receipt" else data.get("invoice", {}),
            "confidence": data.get("confidence", {})
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No file path provided."}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"status": "error", "message": f"File not found: {file_path}"}))
        sys.exit(1)
        
    result = process_document(file_path)
    print(json.dumps(result))
