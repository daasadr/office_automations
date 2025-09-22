import OpenAI from 'openai';

// Check for OpenAI API key and model
const apiKey = import.meta.env.OPENAI_API_KEY;
const model = import.meta.env.OPENAI_MODEL || 'gpt-4o'; // gpt-4o is the newer vision-capable model

if (!apiKey) {
  console.error('Missing OPENAI_API_KEY environment variable');
}

const openai = new OpenAI({
  apiKey: apiKey || '', // Provide empty string as fallback to avoid undefined
});

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
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Normalize input to array
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    const pageCount = images.length;
    
    console.log(`Sending request to OpenAI using model: ${model} for ${pageCount} page(s)`);
    
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

    console.log('Received response from OpenAI');
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    console.log('Raw OpenAI response:', responseContent);

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
    console.log('Cleaned JSON:', cleanedJson);

    let result;
    try {
      result = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', cleanedJson);
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
    };
  } catch (error) {
    console.error('Error validating image with OpenAI:', error);
    if (error instanceof Error) {
      throw new Error(`OpenAI validation failed: ${error.message}`);
    }
    throw error;
  }
}