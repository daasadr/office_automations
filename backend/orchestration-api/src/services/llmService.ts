import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';

// Check for API keys and models
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!openaiApiKey) {
  logger.warn('Missing OPENAI_API_KEY environment variable');
}

if (!geminiApiKey) {
  logger.warn('Missing GEMINI_API_KEY environment variable');
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const gemini = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

const REQUIRED_FIELDS = [
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

export interface ExtractedData {
  'kód odpadu'?: string;
  'název/druh odpadu'?: string;
  'kategorie odpadu'?: string;
  'kód způsobu nakládání'?: string;
  původce?: {
    IČO?: string;
    název?: string;
    adresa?: string;
    'zodpovědná osoba'?: string;
    'samostatná provozovna'?: {
      'číslo provozovny'?: string;
      název?: string;
      adresa?: string;
      'zodpovědná osoba'?: string;
    };
  };
  odběratel?: {
    IČO?: string;
    název?: string;
    adresa?: string;
    IČZ?: string;
  };
  tabulka?: Array<{
    'pořadové číslo'?: number;
    'datum vzniku'?: string;
    'množství vzniklého odpadu'?: number;
    'množství předaného odpadu'?: number;
  }>;
  
  // Legacy fields for backward compatibility
  kod_odpadu?: string;
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

export interface ValidationResult {
  present: string[];
  missing: string[];
  confidence: number;
  extracted_data?: ExtractedData[];
  provider?: 'openai' | 'gemini';
  imagePreview?: string | null;
}

function cleanJsonString(jsonString: string): string {
  // Remove comments (// style and /* */ style)
  return jsonString
    .replace(/\/\/.*$/gm, '') // Remove single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
    .replace(/,\s*]/g, ']'); // Remove trailing commas before closing brackets
}

export async function validateImageContent(base64Images: string | string[]): Promise<ValidationResult> {
  try {
    // Verify API key is available
    if (!openaiApiKey || !openai) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Normalize input to array
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    const pageCount = images.length;
    
    logger.info(`Sending request to OpenAI using model: ${openaiModel} for ${pageCount} page(s)`);
    
    // Build content array with text prompt and all images
    const content: Array<{type: "text", text: string} | {type: "image_url", image_url: {url: string, detail: "high"}}> = [
      {
        type: "text",
        text: `Zkontroluj prosím ${pageCount === 1 ? 'tento obrázek' : `těchto ${pageCount} obrázků`} průběžné evidence odpadů a urči, které z následujících informací obsahuje a které chybí. 

${pageCount > 1 ? 'DŮLEŽITÉ: Analyzuj všechny stránky dohromady - informace se mohou nacházet na jakékoli z poskytnutých stránek. Dokument může obsahovat tabulky s mnoha řádky dat.' : ''}

Převeď jednotlivé tabulky a všechny jejich řádky z dokumenty do JSON formatu. A uveď tyto JSON data v extracted_data poli.

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu:
{"present": ["seznam nalezených typů informací"], "missing": ["seznam chybějících typů informací"], "extracted_data": [...]}

Pro každý nalezený řádek/záznam v dokumentu vytvoř samostatný objekt v extracted_data poli.

Kontrolované typy informací:
${REQUIRED_FIELDS.map((field, index) => `${index + 1}. ${field}`).join('\n')}`
      },
      // Add all images
      ...images.map(imageUrl => ({
        type: "image_url" as const,
        image_url: {
          url: imageUrl,
          detail: "high" as const // For better analysis quality
        }
      }))
    ];

    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        {
          role: "user",
          content: content
        }
      ],
      max_tokens: 2000, // Increased for multi-page documents with many waste records
      temperature: 0.1, // Low temperature for more consistent results
    });

    logger.info('Received response from OpenAI');
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

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
      throw new Error('No valid JSON found in OpenAI response: ' + responseContent);
    }

    // Clean the JSON string
    const cleanedJson = cleanJsonString(jsonString);

    let result;
    try {
      result = JSON.parse(cleanedJson);
    } catch (parseError) {
      logger.error('JSON parse error:', parseError);
      logger.error('Attempted to parse:', cleanedJson);
      throw new Error('Failed to parse JSON response from OpenAI');
    }

    // Validate the structure
    if (!result.present || !result.missing || !Array.isArray(result.present) || !Array.isArray(result.missing)) {
      throw new Error('Invalid response structure from OpenAI. Expected present and missing arrays.');
    }
    
    // Calculate confidence based on how many fields were found
    const confidence = (result.present.length / REQUIRED_FIELDS.length) * 100;

    return {
      present: result.present || [],
      missing: result.missing || [],
      confidence,
      extracted_data: result.extracted_data || [],
      provider: 'openai'
    };
  } catch (error) {
    logger.error('Error validating image with OpenAI:', error);
    if (error instanceof Error) {
      throw new Error(`OpenAI validation failed: ${error.message}`);
    }
    throw error;
  }
}

export async function validatePdfContentWithGemini(pdfBuffer: ArrayBuffer): Promise<ValidationResult> {
  try {
    // Verify Gemini API key is available
    if (!geminiApiKey || !gemini) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY environment variable.');
    }

    logger.info(`Sending PDF request to Gemini using model: ${geminiModel}`);
    
    // Get the model
    const model = gemini.getGenerativeModel({ model: geminiModel });
    
    // Convert ArrayBuffer to Uint8Array for Gemini
    const pdfData = new Uint8Array(pdfBuffer);
    
    const prompt = `Zkontroluj prosím tento PDF dokument průběžné evidence odpadů a urči, které z následujících informací obsahuje a které chybí.

DŮLEŽITÉ: Analyzuj všechny stránky v dokumentu - informace se mohou nacházet na jakékoli stránce. Dokument může obsahovat tabulky s mnoha řádky dat.

Vyextrahuj z toho dokumentu pro každý kód odpadu (do extracted_data pole vytvoř samostatný objekt):
- kód odpadu (katalogové číslo)
- název/druh odpadu
- kategorie odpadu
- kód způsobu nakládání
- původce - IČO, název, adresa, zodpovědná osoba. pokud možno pak také SAMOSTATNÁ PROVOZOVNA (číslo provozovny, název, adresa, zodpovědná osoba)
- odběratel - IČO, název, adresa
- tabulku se sloupci: pořadové číslo, datum vzniku, množství vznikého odpadu, množství předaného odpadu

FORMÁT ODPOVĚDI: Odpověz POUZE validním JSON objektem bez komentářů, vysvětlení nebo dalšího textu:
{"present": ["seznam nalezených typů informací"], "missing": ["seznam chybějících typů informací"], "extracted_data": [...]}

Kontrolované typy informací:
${REQUIRED_FIELDS.map((field, index) => `${index + 1}. ${field}`).join('\n')}`;

    // Create the content parts
    const parts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: Buffer.from(pdfData).toString('base64')
        }
      }
    ];

    // Generate content
    const result = await model.generateContent(parts);
    const response = await result.response;
    const responseContent = response.text();

    logger.info('Received response from Gemini');

    if (!responseContent) {
      throw new Error('No response content from Gemini');
    }

    // Extract JSON from response - try multiple patterns (same as OpenAI version)
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
      throw new Error('No valid JSON found in Gemini response: ' + responseContent);
    }

    // Clean the JSON string
    const cleanedJson = cleanJsonString(jsonString);

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanedJson);
    } catch (parseError) {
      logger.error('JSON parse error:', parseError);
      logger.error('Attempted to parse:', cleanedJson);
      throw new Error('Failed to parse JSON response from Gemini');
    }

    // Validate the structure
    if (!parsedResult.present || !parsedResult.missing || !Array.isArray(parsedResult.present) || !Array.isArray(parsedResult.missing)) {
      throw new Error('Invalid response structure from Gemini. Expected present and missing arrays.');
    }
    
    // Calculate confidence based on how many fields were found
    const confidence = (parsedResult.present.length / REQUIRED_FIELDS.length) * 100;

    return {
      present: parsedResult.present || [],
      missing: parsedResult.missing || [],
      confidence,
      extracted_data: parsedResult.extracted_data || [],
      provider: 'gemini'
    };
  } catch (error) {
    logger.error('Error validating PDF with Gemini:', error);
    if (error instanceof Error) {
      throw new Error(`Gemini validation failed: ${error.message}`);
    }
    throw error;
  }
}

export type ValidationProvider = 'openai' | 'gemini' | 'auto';

export interface ValidationOptions {
  provider?: ValidationProvider;
  preferPdfNative?: boolean;
}

export async function validateDocumentContent(
  input: string | string[] | ArrayBuffer, 
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const { provider = 'auto', preferPdfNative = true } = options;
  
  // If input is ArrayBuffer (PDF), prefer Gemini for native PDF support
  if (input instanceof ArrayBuffer) {
    if (provider === 'auto' && preferPdfNative && geminiApiKey) {
      logger.info('Using Gemini for native PDF processing');
      return validatePdfContentWithGemini(input);
    } else if (provider === 'gemini') {
      return validatePdfContentWithGemini(input);
    } else {
      throw new Error('PDF validation with OpenAI requires conversion to images first. Use Gemini for native PDF support or convert PDF to images.');
    }
  }
  
  // If input is base64 images, use OpenAI
  if (typeof input === 'string' || Array.isArray(input)) {
    if (provider === 'auto' || provider === 'openai') {
      return validateImageContent(input);
    } else if (provider === 'gemini') {
      throw new Error('Gemini validation with base64 images is not implemented. Use OpenAI for image validation or provide PDF buffer for Gemini.');
    }
  }
  
  throw new Error('Invalid input type for document validation');
}





