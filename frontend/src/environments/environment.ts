export const environment = {
  production: true,
  // Same-origin: the contact form is served by a Vercel serverless function
  // living in this same project (see frontend/api/contact.ts), not a
  // separately-hosted backend — no CORS needed.
  apiUrl: '/api'
};
