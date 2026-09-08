# Portfolio API

ASP.NET Core 8 Web API backing the contact form on the portfolio site.

## Run locally

```bash
dotnet restore
dotnet run
```

Swagger UI is available at `/swagger` in Development.

## Configuration

All configuration is read the standard ASP.NET Core way — `appsettings.json`
holds structure and safe defaults only. Set real values as **environment
variables** (these override `appsettings.json` automatically):

| Variable                          | Purpose                                   |
|------------------------------------|--------------------------------------------|
| `Cors__AllowedOrigin`              | Exact origin of the deployed frontend       |
| `Smtp__Host`                       | SMTP server host                            |
| `Smtp__Port`                       | SMTP server port                            |
| `Smtp__Username`                   | SMTP auth username                          |
| `Smtp__Password`                   | SMTP auth password / app password           |
| `Smtp__FromAddress`                | "From" address for outgoing mail            |
| `ContactRecipient__Email`          | Where contact-form submissions are sent     |

If `Smtp__Host` is left unset, submissions are written to the application
log instead of emailed, so local development works without any provider
configured. Swap `SmtpEmailService` for another `IEmailService`
implementation (SendGrid, Postmark, SES, etc.) when you pick a provider —
nothing else in the app needs to change.

## Endpoints

- `POST /api/contact` — validates, sanitizes, and forwards a contact-form
  submission. Rate limited to 5 requests/minute per IP.

## Deployment notes

- Never commit real SMTP credentials — only environment variables carry them.
- `UseHsts()` and `UseHttpsRedirection()` are enabled outside Development.
- CORS is restricted to a single configured origin.
