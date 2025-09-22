import { createDirectus, rest, authentication, staticToken } from '@directus/sdk';

// Define your schema types here
// TODO: Add your collection types
interface Schema {
  // Example:
  // collections: {
  //   posts: {
  //     id: number;
  //     title: string;
  //     content: string;
  //   };
  // };
}

if (!import.meta.env.DIRECTUS_URL) {
  throw new Error('DIRECTUS_URL environment variable is not set');
}

const client = createDirectus<Schema>(import.meta.env.DIRECTUS_URL)
  .with(rest())
  .with(authentication());

// Initialize the client with either static token or email/password
const initializeClient = async () => {
  try {
    if (import.meta.env.DIRECTUS_TOKEN) {
      // Use static token authentication
      client.with(staticToken(import.meta.env.DIRECTUS_TOKEN));
    } else if (import.meta.env.DIRECTUS_EMAIL && import.meta.env.DIRECTUS_PASSWORD) {
      // Use email/password authentication
      await client.login(
        import.meta.env.DIRECTUS_EMAIL,
        import.meta.env.DIRECTUS_PASSWORD,
      );
    } else {
      throw new Error('No authentication method provided. Set either DIRECTUS_TOKEN or DIRECTUS_EMAIL and DIRECTUS_PASSWORD');
    }
  } catch (error) {
    console.error('Failed to initialize Directus client:', error);
    throw error;
  }
};

// Initialize the client when this module is imported
initializeClient().catch(console.error);

export { client, type Schema };
