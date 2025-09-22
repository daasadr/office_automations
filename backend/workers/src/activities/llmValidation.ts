import { createWorkerLogger } from '../shared/logger';
import { config } from '../shared/config';
import OpenAI from 'openai';

const logger = createWorkerLogger('llm-validation');

export interface ValidateWasteDocumentInput {
  jobId: string;
  processedImages: string[]; // Base64 encoded images
  fileName: string;
}

export interface ExtractedWasteData {
  druh_odpadu?: string;
  kategorie_odpadu?: string;
  mnozstvi_odpadu?: string;
  zpusob_nakládání?: string;
  datum_vzniku?: string;
  identifikace_prijemce?: string;
  přepravce_odpadu?: string;
  doklady_spojené_s_odpadem?: string;
  identifikační_čísla_zařízení?: string;
}

export interface WasteValidationResult {
  jobId: string;
  fileName: string;
  present: string[];
  missing: string[];
  confidence: number;
  extractedData: ExtractedWasteData[];
  success: boolean;
  error?: string;
}

const REQUIRED_WASTE_FIELDS = [
  'Druh odpadu (katalogové číslo podle vyhlášky č. 8/2021 Sb.)',
  'Kategorie odpadu (O – ostatní, N – nebezpečný)',
  'Množství odpadu (v tunách nebo kg)',
  'Způsob nakládání (přeprava, předání, využití, odstranění)',
  'Datum vzniku nebo převzetí/předání odpadu',
  'Identifikace příjemce/předávající osoby (IČO, název, adresa)',
  'Přepravce odpadu (pokud je jiný než předávající nebo příjemce)',
  'Doklady spojené s odpadem (převodní listy, vážní lístky, smlouvy)',
  'Identifikační čísla zařízení (IČZ), kam byl odpad předán (pokud známé)',
];

function cleanJsonString(jsonString: string): string {
  // Remove comments (// style and /* */ style)
  return jsonString
    .replace(/\/\/.*$/gm, '') // Remove single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
    .replace(/,\s*]/g, ']'); // Remove trailing commas before closing brackets
}

/**
 * Validate waste document using OpenAI vision models
 * This replaces the frontend's openai.ts validation logic
 */
export async function validateWasteDocument(input: ValidateWasteDocumentInput): Promise<WasteValidationResult> {
  logger.info('Starting waste document validation', { 
    jobId: input.jobId, 
    fileName: input.fileName,
    imageCount: input.processedImages.length
  });

  try {
    // Verify API key is available
    const apiKey = config.llm.openai.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const openai = new OpenAI({ apiKey });
    const model = config.llm.openai.model;
    const pageCount = input.processedImages.length;
    
    logger.info('Sending request to OpenAI', { 
      jobId: input.jobId, 
      model, 
      pageCount 
    });
    
    // Build content array with text prompt and all images
    const content: Array<{type: "text", text: string} | {type: "image_url", image_url: {url: string, detail: "high"}}> = [
      {
        type: "text",
        text: `Zkontroluj prosím ${pageCount === 1 ? 'tento obrázek' : `těchto ${pageCount} obrázků`} průběžné evidence odpadů a urči, které z následujících informací obsahuje a které chybí. 

${pageCount > 1 ? 'DŮLEŽITÉ: Analyzuj všechny stránky dohromady - informace se mohou nacházet na jakékoli z poskytnutých stránek. Dokument může obsahovat tabulky s mnoha řádky dat.' : ''}

Z dokumentu extrahuj VŠECHNY jednotlivé záznamy/řádky nakládání s odpadem. Každý řádek tabulky nebo záznam v dokumentu představuje samostatný objekt v extracted_data poli. Pokud dokument obsahuje mnoho řádků, extrahuj je všechny.

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu:
{"present": ["seznam nalezených typů informací"], "missing": ["seznam chybějících typů informací"], "extracted_data": [{"druh_odpadu": "konkrétní hodnota", "kategorie_odpadu": "O/N", "mnozstvi_odpadu": "číslo s jednotkou", "zpusob_nakládání": "konkrétní způsob", "datum_vzniku": "datum", "identifikace_prijemce": "IČO/název", "přepravce_odpadu": "název/IČO", "doklady_spojené_s_odpadem": "čísla/názvy", "identifikační_čísla_zařízení": "IČZ čísla"}]}

Pro každý nalezený řádek/záznam v dokumentu vytvoř samostatný objekt v extracted_data poli.

Kontrolované typy informací:
${REQUIRED_WASTE_FIELDS.map((field, index) => `${index + 1}. ${field}`).join('\n')}`
      },
      // Add all images
      ...input.processedImages.map(imageUrl => ({
        type: "image_url" as const,
        image_url: {
          url: imageUrl,
          detail: "high" as const // For better analysis quality
        }
      }))
    ];

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: content
        }
      ],
      max_tokens: 4000, // Significantly increased for multi-page documents with many waste records
      temperature: 0.1, // Low temperature for more consistent results
    });

    logger.info('Received response from OpenAI', { jobId: input.jobId });
    
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    logger.info('Raw OpenAI response received', { 
      jobId: input.jobId, 
      responseLength: responseContent.length 
    });

    // Extract JSON from response - try multiple patterns
    let jsonString: string | null = null;
    
    // First try to find JSON block with braces
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    } else {
      // If no braces found, try to extract from code blocks
      const codeBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
      }
    }

    if (!jsonString) {
      throw new Error('No valid JSON found in OpenAI response');
    }

    // Clean the JSON string
    const cleanedJson = cleanJsonString(jsonString);
    logger.info('Cleaned JSON response', { jobId: input.jobId, jsonLength: cleanedJson.length });

    let result;
    try {
      result = JSON.parse(cleanedJson);
    } catch (parseError) {
      logger.error('JSON parse error', { jobId: input.jobId, parseError, cleanedJson });
      throw new Error('Failed to parse JSON response from OpenAI');
    }

    // Validate the structure
    if (!result.present || !result.missing || !Array.isArray(result.present) || !Array.isArray(result.missing)) {
      throw new Error('Invalid response structure from OpenAI. Expected present and missing arrays.');
    }
    
    // Calculate confidence based on how many fields were found
    const confidence = (result.present.length / REQUIRED_WASTE_FIELDS.length) * 100;

    logger.info('Waste document validation completed successfully', { 
      jobId: input.jobId,
      presentFields: result.present.length,
      missingFields: result.missing.length,
      confidence,
      extractedRecords: result.extracted_data?.length || 0
    });

    return {
      jobId: input.jobId,
      fileName: input.fileName,
      present: result.present || [],
      missing: result.missing || [],
      confidence,
      extractedData: result.extracted_data || [],
      success: true
    };

  } catch (error) {
    logger.error('Waste document validation failed', { 
      jobId: input.jobId, 
      fileName: input.fileName, 
      error 
    });
    
    return {
      jobId: input.jobId,
      fileName: input.fileName,
      present: [],
      missing: REQUIRED_WASTE_FIELDS,
      confidence: 0,
      extractedData: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Generic LLM text extraction for other document types
 */
export interface ExtractTextDataInput {
  jobId: string;
  processedImages: string[];
  fileName: string;
  extractionPrompt: string;
  expectedFields: string[];
}

export interface ExtractTextDataResult {
  jobId: string;
  fileName: string;
  extractedFields: Record<string, any>;
  confidence: Record<string, number>;
  success: boolean;
  error?: string;
}

export async function extractTextData(input: ExtractTextDataInput): Promise<ExtractTextDataResult> {
  logger.info('Starting generic text extraction', { 
    jobId: input.jobId, 
    fileName: input.fileName,
    imageCount: input.processedImages.length,
    expectedFieldCount: input.expectedFields.length
  });

  try {
    const apiKey = config.llm.openai.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const openai = new OpenAI({ apiKey });
    const model = config.llm.openai.model;
    
    const content = [
      {
        type: "text" as const,
        text: input.extractionPrompt
      },
      ...input.processedImages.map(imageUrl => ({
        type: "image_url" as const,
        image_url: {
          url: imageUrl,
          detail: "high" as const
        }
      }))
    ];

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: "user", content }],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    // Try to parse JSON response
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(cleanJsonString(jsonMatch[0]));

    logger.info('Generic text extraction completed', { 
      jobId: input.jobId,
      extractedFields: Object.keys(result.fields || {}).length
    });

    return {
      jobId: input.jobId,
      fileName: input.fileName,
      extractedFields: result.fields || {},
      confidence: result.confidence || {},
      success: true
    };

  } catch (error) {
    logger.error('Generic text extraction failed', { 
      jobId: input.jobId, 
      error 
    });
    
    return {
      jobId: input.jobId,
      fileName: input.fileName,
      extractedFields: {},
      confidence: {},
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error'
    };
  }
}

