using System.Text.RegularExpressions;
using PortfolioApi.DTOs;
using PortfolioApi.Models;

namespace PortfolioApi.Services;

/// <summary>
/// Business logic for the contact form. Model-level validation (required
/// fields, lengths, email format) is already enforced by data annotations
/// on the DTO before this runs; this layer adds bot rejection and
/// defensive sanitization of free-text input before it is persisted or emailed.
/// </summary>
public sealed class ContactService : IContactService
{
    // Strips control characters and collapses excessive whitespace. This is not
    // HTML sanitization (the value is never rendered as HTML) — it just keeps
    // plain-text fields from carrying invisible or disruptive characters.
    private static readonly Regex ControlCharacters = new(@"[\u0000-\u0008\u000B\u000C\u000E-\u001F]", RegexOptions.Compiled);

    private readonly IEmailService _emailService;
    private readonly ILogger<ContactService> _logger;

    public ContactService(IEmailService emailService, ILogger<ContactService> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<ContactResponseDto> SubmitAsync(ContactRequestDto request, CancellationToken cancellationToken = default)
    {
        // Honeypot: a hidden field real visitors never fill in.
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            _logger.LogWarning("Contact form submission rejected by honeypot check.");
            // Return a generic success so bots don't learn the honeypot exists.
            return new ContactResponseDto { Success = true, Message = "Thanks — your message has been sent." };
        }

        var message = new ContactMessage
        {
            Name = Sanitize(request.Name),
            Email = request.Email.Trim(),
            Message = Sanitize(request.Message)
        };

        await _emailService.SendContactNotificationAsync(message, cancellationToken);

        return new ContactResponseDto { Success = true, Message = "Thanks — your message has been sent." };
    }

    private static string Sanitize(string input)
    {
        var trimmed = input.Trim();
        var withoutControlChars = ControlCharacters.Replace(trimmed, string.Empty);
        return Regex.Replace(withoutControlChars, @"\s{3,}", "  ");
    }
}
