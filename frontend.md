Build the VayuDrishti React + Vite + TypeScript frontend inside a new `frontend/` 
directory at the project root. Use Leaflet + react-leaflet for maps and React Router 
for navigation. Do NOT use Tailwind — use vanilla CSS with a dark, premium design.

The backend FastAPI runs at http://localhost:8000/api/v1.

Build these pages in order:

1. **SubmitReportPage** (`/submit`)
   - Multipart form: image upload (JPEG/PNG, shows preview), latitude + longitude 
     (auto-filled by map), address (text), description (textarea), 
     category select (construction / demolition / road_dust / unknown)
   - Embedded Leaflet map — click to drop a pin → fills lat/lng fields
   - On submit: POST /api/v1/reports as multipart/form-data
   - On success: show report_id, status badge, signed image URL

2. **MyReportsPage** (`/my-reports`)
   - GET /api/v1/reports?limit=20
   - Card list: report_id, status badge (colour-coded), priority_score, 
     location, submitted_at
   - Click a card → GET /api/v1/reports/{id} and show full detail + 
     AI analysis fields (dust_present, severity, category)

3. **MapPage** (`/map`)
   - GET /api/v1/reports?limit=200, render each as a Leaflet circle marker
   - Colour by priority_score: red (>70), orange (40-70), green (<40)
   - Click marker → popup with report_id, status, description, priority_score

4. **App shell**
   - Top nav with links: Submit Report | My Reports | Map
   - Dark theme, glassy card components, smooth hover animations
   - API base URL from VITE_API_BASE_URL env var (default http://localhost:8000/api/v1)
