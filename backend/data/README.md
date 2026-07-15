# Aria RAG Data Ingestion Folder

This directory holds the reference materials that you want the Aria AI therapist to use for therapy guidelines (e.g. CBT/DBT/ACT techniques).

### How to Feed Data to Aria:
1. Put any reference files in **`.txt`** or **`.md`** format inside this directory (`backend/data`).
2. Give files descriptive names. If the file name contains the keyword `dbt`, `act`, `mindfulness`, or `motivational`, the ingestion pipeline will automatically tag those chunks with that therapeutic modality.
3. Run the ingestion command:
   ```bash
   npm run ingest
   ```
4. Verify your Qdrant vector database has points successfully stored.

*Note: Ensure your Qdrant collection is configured with **768 dimensions** (to match Gemini's `text-embedding-004` embedding space).*
