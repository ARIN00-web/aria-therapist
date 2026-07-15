import os
import sys

# Try importing pypdf, install if missing
try:
    import pypdf
except ImportError:
    print("Installing pypdf library for PDF processing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    import pypdf

# Directory containing the PDFs
data_dir = os.path.join(os.path.dirname(__file__), "../../data")
pdf_files = [f for f in os.listdir(data_dir) if f.endswith(".pdf")]

print(f"==================================================================")
print(f"[PDF Converter] Found {len(pdf_files)} PDF files to convert.")
print(f"==================================================================")

for pdf_file in pdf_files:
    pdf_path = os.path.join(data_dir, pdf_file)
    txt_file = os.path.splitext(pdf_file)[0] + ".txt"
    txt_path = os.path.join(data_dir, txt_file)
    
    if os.path.exists(txt_path):
        print(f"--> Skipping {pdf_file} (already converted to txt)")
        continue
        
    print(f"--> Converting {pdf_file} to {txt_file}...")
    try:
        reader = pypdf.PdfReader(pdf_path)
        num_pages = len(reader.pages)
        
        with open(txt_path, "w", encoding="utf-8") as f:
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    f.write(text + "\n")
                if (i + 1) % 50 == 0 or (i + 1) == num_pages:
                    print(f"    Processed page {i + 1}/{num_pages}")
                    
        print(f"[✓] Successfully converted: {pdf_file}")
    except Exception as e:
        print(f"[✗] Failed to convert {pdf_file}: {e}")

print("==================================================================")
print("All conversions complete! Your files are ready in backend/data/")
print("==================================================================")
