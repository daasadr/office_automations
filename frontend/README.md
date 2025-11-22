# File Processing App

A modern, accessible Astro application for uploading, processing, and downloading files. Built with TypeScript, shadcn/ui components, Tailwind CSS, progressive enhancement, and comprehensive accessibility features.

## Features

- 📁 **File Upload**: Drag & drop or click to upload CSV and Excel files
- 🔄 **Processing**: Real-time status updates with progress tracking
- 📥 **Download**: Multiple result files with bulk download option
- ♿ **Accessibility**: WCAG 2.1 AA compliant with screen reader support
- 📱 **Responsive**: Mobile-first design with smooth view transitions
- 🎨 **Modern UI**: Beautiful interface with dark mode support
- ⚡ **Performance**: Server-side rendering with minimal client-side JavaScript
- 🔧 **Progressive Enhancement**: Works without JavaScript in older browsers
- 📲 **PWA Ready**: Installable on desktop and mobile devices - see [PWA Setup](./PWA-SETUP.md)

## Tech Stack

- **Frontend**: Astro 4 with TypeScript and React integration
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Backend**: Simulated processing (ready for Directus 9 integration)
- **Accessibility**: WCAG 2.1 AA compliant with comprehensive ARIA support
- **Deployment**: Server-side rendering with Node.js adapter

## Prerequisites

- Node.js 18+ 
- **Poppler utilities** (for PDF processing):
  - **macOS**: `brew install poppler`
  - **Ubuntu/Debian**: `sudo apt-get install poppler-utils`
  - **CentOS/RHEL**: `sudo yum install poppler-utils`
  - **Windows**: Download from [Poppler for Windows](https://blog.alivate.com.au/poppler-windows/)
- OpenAI API key (for document validation)
- Modern web browser

## Quick Start

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp env.template .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # OpenAI Configuration (required for PDF validation)
   OPENAI_API_KEY=your-openai-api-key-here
   OPENAI_MODEL=gpt-4o
   
   # Directus Configuration (optional)
   DIRECTUS_URL=http://localhost:8055
   DIRECTUS_EMAIL=admin@example.com
   DIRECTUS_PASSWORD=your-password
   # OR use static token
   DIRECTUS_TOKEN=your-static-token
   ```

3. **Set up Directus collections**:
   
   Create these collections in your Directus instance:

   **file_processing_jobs**:
   ```sql
   - id (UUID, Primary Key)
   - status (String: pending|processing|completed|failed)
   - original_file (File relation)
   - original_filename (String)
   - user_created (User relation, optional)
   - date_created (DateTime)
   - date_updated (DateTime)
   - processing_started (DateTime, optional)
   - processing_completed (DateTime, optional)
   - progress (Integer, 0-100)
   - current_step (String, optional)
   - error_message (Text, optional)
   - metadata (JSON, optional)
   ```

   **processing_results**:
   ```sql
   - id (UUID, Primary Key)
   - job (Relation to file_processing_jobs)
   - name (String)
   - description (Text)
   - file (File relation)
   - type (String: primary|secondary)
   - sort (Integer, optional)
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Navigate to `http://localhost:4321`

## Project Structure

```
src/
├── components/           # Reusable UI components
│   └── ScreenReaderOnly.astro
├── layouts/             # Page layouts
│   └── BaseLayout.astro
├── pages/               # Route pages
│   ├── api/            # API endpoints
│   │   ├── upload.ts
│   │   ├── status/[jobId].ts
│   │   └── download/[jobId]/[filename].ts
│   ├── index.astro     # Upload page
│   ├── processing.astro # Processing status page
│   └── download.astro  # Results download page
├── types/              # TypeScript definitions
│   └── directus.ts
└── utils/              # Utility functions
    └── directus.ts     # Directus integration
```

## Accessibility Features

This application is built with accessibility as a core requirement:

### Screen Reader Support
- Semantic HTML structure with proper heading hierarchy
- ARIA labels and descriptions for interactive elements
- Screen reader only content for additional context
- Live regions for dynamic content updates

### Keyboard Navigation
- Full keyboard accessibility with logical tab order
- Skip links for main content navigation
- Focus management and visible focus indicators
- Escape key handling for modals and overlays

### Visual Accessibility
- High contrast color scheme with dark mode support
- Scalable text and UI elements
- Clear visual hierarchy and spacing
- Color-blind friendly design

### Motor Accessibility
- Large touch targets (minimum 44px)
- Reduced motion support for animations
- Drag and drop with click alternatives

## Progressive Enhancement

The application works without JavaScript through:

- **Server-side form processing**: File uploads work with standard HTML forms
- **Automatic page refreshing**: Processing status updates via server redirects
- **Fallback navigation**: All features accessible through traditional page loads
- **Enhanced experience**: JavaScript adds drag & drop, real-time updates, and smooth transitions

## API Endpoints

### POST /api/upload
Upload a file for processing.

**Request**: `multipart/form-data` with `file` field
**Response**: JSON with `success`, `jobId`, and optional `error`

### GET /api/status/[jobId]
Get processing job status.

**Response**: JSON with job details, progress, and current step

### GET /api/download/[jobId]/[filename]
Download a processed file.

**Response**: File stream with appropriate headers

## Environment Variables

```env
# Directus Configuration
DIRECTUS_URL=http://localhost:8055
DIRECTUS_EMAIL=admin@example.com
DIRECTUS_PASSWORD=password
DIRECTUS_TOKEN=optional-static-token

# Application Configuration
NODE_ENV=development
PUBLIC_APP_NAME="File Processing App"
PUBLIC_APP_URL=http://localhost:4321

# File Processing
MAX_FILE_SIZE=10485760          # 10MB in bytes
ALLOWED_FILE_TYPES=text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
FILE_RETENTION_DAYS=30
```

## Deployment

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Deploy to Node.js

The app uses the Node.js adapter and can be deployed to any Node.js hosting service:

1. Build the application
2. Upload the `dist/` folder to your server
3. Install production dependencies: `npm ci --production`
4. Set environment variables
5. Start the server: `node dist/server/entry.mjs`

## Browser Support

- **Modern browsers**: Full feature support with view transitions and PWA installation
- **Older browsers**: Progressive enhancement ensures core functionality
- **Internet Explorer**: Basic functionality (no animations/transitions)
- **Screen readers**: Fully compatible with JAWS, NVDA, VoiceOver
- **PWA Support**: Chrome, Edge, Safari 11.3+, Firefox, Samsung Internet

> **Note**: To install the app on your device, see the [PWA Setup Guide](./PWA-SETUP.md)

## Performance Features

- Server-side rendering for fast initial page loads
- Minimal JavaScript bundle with progressive enhancement
- Optimized images and assets
- Efficient CSS with custom properties
- View transitions for smooth navigation (modern browsers)

## Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run check      # Run Astro type checking
```

### Code Style

The project follows these conventions:
- TypeScript for type safety
- Semantic HTML structure
- CSS custom properties for theming
- Progressive enhancement principles
- Accessibility-first development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Ensure accessibility standards are maintained
4. Test with screen readers and keyboard navigation
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the documentation above
2. Review Directus setup requirements
3. Test with browser developer tools
4. Verify environment configuration
