using System.Net;
using System.Text.Json;

namespace PortfolioApi.Middleware;

/// <summary>
/// Catches unhandled exceptions and returns a generic JSON error, so internal
/// details (stack traces, exception messages) are never leaked to clients —
/// especially important in production.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception while processing {Method} {Path}", context.Request.Method, context.Request.Path);

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var payload = _environment.IsDevelopment()
                ? new { success = false, message = "An unexpected error occurred.", detail = ex.Message }
                : new { success = false, message = "An unexpected error occurred.", detail = (string?)null };

            await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
        }
    }
}
