# STD standards notes (eCH and salary certificate), checked 2026-10-13

Facts below come from automated fetch summaries of the official PDFs and pages. Check key values against the PDFs before implementing.

## eCH-0196 (Relevé fiscal électronique) barcode annex

- Annex title: "Annex de eCH-0196 Relevé fiscal électronique V2.2.0 - Génération de codes-barres"; edition 2022-06-07, decision 2022-06-02, approved; file name says V2.0.0 (https://ech.ch/sites/default/files/dosvers/beilagen/BEIL2_f_DEF_2022-06-07_eCH-0196_V2.0.0_Codes-barres%20G%C3%A9n%C3%A9ration-%20Instruction%20technique.pdf)
- 1D barcode: CODE128C, 16 numeric digits: form 196 (3), version (2), organisation/clearing number (5), page (3), 2D-sheet flag (1), orientation (1), reading direction (1) (same URL)
- 1D minimum size 7 mm high and 38 mm wide; must not be printed in greyscale (same URL)
- 2D barcode: PDF417 Structured Append, error correction level 4, 6 segments, 13 columns, 35 rows, images 290 x 35 px (same URL)
- Payload compression: ZLIB via java.util.zip.Deflater at maximum compression (BEST_COMPRESSION); XML is schema-validated after extraction (same URL)
- Character encoding of the XML payload and any header bytes are not specified (same URL)
- Document ID is the root element ID attribute, unique across Switzerland, xs:ID type; components: country code, organisation, page, client base or NAVS13, reference date AAAAMMJJ, sequence from 01 (same URL)
- The annex example uses country code "SO", probably meant "CH"; NAVS13 length is given inconsistently (13 numeric vs 14 alphanumeric) (same URL)
- PDF metadata: attribute PDFMacroFileName holds the document ID and PDFMacroFileId a 4-integer random number, readable even if payload decompression fails (same URL)
- Main eCH-0196 V2.x document and its schema eCH-0196-2-2.xsd: not found; the schema name is taken from the eCH-0278 annex (https://ech.ch/sites/default/files/imce/eCH-Dossier/eCH-Dossier_PDF_Publikationen/Hauptdokument/STAN_d_DEF_2026-02-05_eCH-f0278_V1.0.0_E-Tax_NP.pdf)

## eCH-0270 (Génération de codes-barres) for tax documents

- Version 1.0.0 (first version), publication 2024-11-04, decision 2024-11-27, approved; French translation of German original; no annexes (https://ech.ch/sites/default/files/imce/eCH-Dossier/eCH-Dossier_PDF_Publikationen/Hauptdokument/STAN_f_DEF_2024-11-04_eCH-0270_V1.0.0_Generation%20codes-barres.pdf)
- 1D: Code 128 set C, 16 numeric digits; first 3 digits = eCH form number without leading zeros; the other 13 defined per document (2D-sheet flag, page numbering) (same URL)
- 2D: PDF417 Structured Append, EC level 4, 6 blocks x 13 columns x 35 rows, 290 x 35 px images, the same layout as the eCH-0196 annex (same URL)
- Payload: XML compressed with a "ZIP file algorithm"; deflate, gzip or zlib not specified; schema validation after extraction (same URL)
- Conflict: eCH-0270 does not name the compression variant, while the eCH-0196 annex specifies ZLIB; the parser should not assume one without testing (both URLs above)
- The document ID must appear in both the PDF417 control block and the payload; eCH-0270 does not say it supersedes the eCH-0196 annex (same URL)

## eCH-0278 (E-Tax NP) versus eCH-0119

- Version 1.0.0, marked "Neu" (no predecessor version listed). Cover: approved and issued 2026-02-05. Body: approval decision 2026-05-18, and section 1.1 calls it a proposal not yet normatively valid. Status must be confirmed (https://ech.ch/sites/default/files/imce/eCH-Dossier/eCH-Dossier_PDF_Publikationen/Hauptdokument/STAN_d_DEF_2026-02-05_eCH-f0278_V1.0.0_E-Tax_NP.pdf)
- Scope: nationwide uniform data format for natural persons' tax data, based on the SSK data model; covers declaration, assessment, statistics and long-term archiving; legal entities excluded (same URL)
- It is a data format only: no transport, encryption, system architecture or visualisation (same URL)
- Replacement: intended to replace eCH-0119 after a transition period; the length of the period and any effective date are not stated (same URL)
- Cantonal extensions are more restricted than in eCH-0119 and to be used only when strictly necessary (same URL)
- Namespace: http://www.ech.ch/xmlns/ech-0278/1; schema file eCH-0278-1-0.xsd; Excel data model BEIL_d_f_i_DRA_JJJJ-MM-TT-eCH0278_V1.0.0_E-Tax_NP.xlsx (date placeholder in name); no download URL found (same URL)
- eCH-0278 schema references: eCH-0196-2-2.xsd, eCH-0248-1-0.xsd, eCH-0275-1-0.xsd (Anhang A, table 6) (same URL)

## eCH-0119 (E-Tax Filing), latest v4.x found

- Version 4.0.0, decision 2021-03-02, issued 2021-03-08, approved; replaces v3.2; no v4.1 or later found in search (https://ech.ch/sites/default/files/dosvers/hauptdokument/STAN_d_DEF_2021-03-08_eCH-0119_V4.0.0_E-Tax%20Filing_1.pdf)
- Schema eCH-0119-4-0-0.xsd is listed as an annex, but no download URL was found; sample forms ZIP (11 PDFs, BEIL1_d_eCH-0119_V4.0.0_Musterformulare_SSK_STE-NP.zip) also not located (same URL)

## Salary certificate (Lohnausweis, Formular 11)

- Current guide valid from 2026-01-01, in German and French; form 605.040.18, guides 605.040.18.1d and .1f; by SSK and ESTV (https://www.estv.admin.ch/dam/de/sd-web/afP1GDFr8gE3/dbst-form-lohna-wegleitung-2026-de.pdf and https://www.estv.admin.ch/dam/fr/sd-web/afP1GDFr8gE3/dbst-form-lohna-wegleitung-2026-fr.pdf)
- Neither guide mentions a 2D barcode, Datamatrix, PDF417, Swissdec or eCH; only the electronic application "eLohnausweis" is named (both URLs above)
- ESTV index lists the 2026 guide (published 2026-01-15), the 2025 guide, the 2026 FAQ and the CSI application at https://www.elohnausweis-ssk.ch/fr/#/ (https://www.estv.admin.ch/fr/certificat-de-salaire-et-attestation-de-rentes)
- CSI page "Certificat de salaire électronique CSI" describes the web tool and migration PDF; no barcode or XML spec; updated 2026-10-13 (https://www.ssk-csi.ch/fr/themen/certificat-de-salaire/certificat-de-salaire)
- CSI "Généralités" page: no technical spec, only links to ESTV forms and cantonal contacts; updated 2026-10-12 (https://www.ssk-csi.ch/fr/themen/certificat-de-salaire/generalites)
- Result: no official specification of the salary certificate 2D barcode was found. Do not assume it matches eCH-0270 or eCH-0196 until a source is confirmed
- Swissdec ELM overview (certification of payroll software, first edition April 2021) lists salary certificate as a domain but gives no barcode spec; not in manifest (https://swissdec.ch/document/share/249/916ebde0-1279-4eb3-a7ff-3975727998ee)

## Salary certificate 2D barcode (Swissdec TxAB), checked 2026-10-14

- Specified by Swissdec, not by the ESTV or the CSI pages: "Directives certificat de salaire" ELM 5.0, a ZIP archive with the overview PDF, the schema SalaryDeclarationTxAB.xsd and test data (https://swissdec.ch/document/share/97/6ca08e4a-716b-46b1-90a2-5b2ae801b209), and its ELM 6.0 edition "Annexe 5 Directives certificat de salaire" (https://swissdec.ch/document/share/491/6d03c73e-4054-42c6-b368-8099c06c3720); both listed on https://www.swissdec.ch/elm
- Content: the XML (namespace http://www.swissdec.ch/schema/sd/20200220/SalaryDeclarationTxAB, or urn:ch:swissdec:elm:v6:20260306:SalaryDeclarationTxAB for ELM 6.0) in an Info-ZIP archive with one entry named "txab", then 14 control bytes at the start of each PDF417 symbol (identification, compression "z", size, page control, version, symbol number and count); the data can be split over several symbols (TaxAccountingOverview_f.pdf in the ELM 5.0 archive, and Richtlinien_Barcode_fr.pdf in the ELM 6.0 one)
- The schema documents the box of each element (c1 to c15, E, F, G); Taxpresso maps them in extension/src/barcode.ts (TXAB_KEYS) and docs/spikes/S2.md
- The control bytes do not follow eCH-0270, and the barcode is not PDF417 Structured Append

## eCH-0196 V2.2.0 schema and guides, checked 2026-10-14

- Schema eCH-0196-2-2.xsd, main document (French) and technical guide (German) are on the eCH page of the standard (https://www.ech.ch/de/ech/ech-0196/2.2.0); the schema imports eCH-0007, eCH-0008, eCH-0010 and eCH-0097 from www.ech.ch/xmlns, which are not in the library
- Technical guide section 3: the barcode segments are generated as images at 1 x 1 pixel per element, and the XML is extracted from the last page backwards, rendering a page when it has no barcode images (https://www.ech.ch/sites/default/files/dosvers/beilagen/BEIL1_d_DEF_2022-06-07_eCH-0196_V2.2.0_Technische%20Wegleitung.pdf)
- The compression conflict (ZLIB in the annex, "ZIP" in eCH-0270) is not settled by these documents

## Gaps

- eCH-0196 V2.x main document and eCH-0196-2-2.xsd: found 2026-10-14, see the section below
- eCH-0278 XSD (eCH-0278-1-0.xsd) and Excel data model: names known, download URLs not found
- eCH-0119 XSD (eCH-0119-4-0-0.xsd) and sample forms ZIP: URLs not found
- eCH-0248 and eCH-0275 main documents and schemas (eCH-0248-1-0.xsd, eCH-0275-1-0.xsd): not found
- Salary certificate 2D barcode specification: found 2026-10-14 at Swissdec, see the section below; CSI migration PDF (https://www.ssk-csi.ch/fileadmin/dokumente/lohnausweis/eLohnausweis_Migration_fr.pdf) not fetched
- German edition of the eCH-0196 barcode annex and eCH-0270 XSD (none published with eCH-0270): not checked
- Swissdec ELM salary data standard document: the salary certificate parts are in the library (std-swissdec-elm5-lohnausweis-richtlinien-fr, std-swissdec-elm6-barcode-annexe5); the full ELM guidelines are not
