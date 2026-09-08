namespace PortfolioApi.Models;

/// <summary>
/// Internal representation of a validated, sanitized contact submission.
/// </summary>
public sealed class ContactMessage
{
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTimeOffset ReceivedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
