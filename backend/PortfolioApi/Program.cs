using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using PortfolioApi.Middleware;
using PortfolioApi.Services;

var builder = WebApplication.CreateBuilder(args);

// Configuration precedence (highest to lowest) is already handled by the
// default host builder: command-line args > environment variables >
// appsettings.{Environment}.json > appsettings.json. Secrets such as
// Smtp:Username / Smtp:Password should be supplied as environment
// variables (Smtp__Username, Smtp__Password) in every real deployment —
// appsettings.json only carries empty placeholders.

const string FrontendCorsPolicy = "FrontendCorsPolicy";
const string ContactRateLimitPolicy = "contact";

// ---- Options binding -------------------------------------------------
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.Configure<ContactRecipientOptions>(builder.Configuration.GetSection("ContactRecipient"));

// ---- Application services ---------------------------------------------
builder.Services.AddScoped<IContactService, ContactService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// ---- MVC / API ----------------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "Portfolio API", Version = "v1" });
});

// ---- CORS: only the configured frontend origin may call this API --------
var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:4201";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins(allowedOrigin)
              .WithMethods("GET", "POST")
              .WithHeaders("Content-Type")
              .DisallowCredentials();
    });
});

// ---- Rate limiting: protect the public contact endpoint from abuse ------
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy(ContactRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var app = builder.Build();

// Global exception handling first, so nothing downstream can leak internals.
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // HSTS only makes sense once the site is served over HTTPS in production.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseCors(FrontendCorsPolicy);
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

app.Run();
