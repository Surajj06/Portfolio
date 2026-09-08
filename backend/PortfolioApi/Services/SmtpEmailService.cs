using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using PortfolioApi.Models;

namespace PortfolioApi.Services;

public sealed class SmtpOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
}

public sealed class ContactRecipientOptions
{
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

/// <summary>
/// Sends the contact-form notification over SMTP. All credentials come from
/// configuration, which in turn is expected to be populated from environment
/// variables (e.g. Smtp__Host, Smtp__Username, Smtp__Password) rather than
/// checked-in files. If SMTP is not configured, the message is logged
/// instead of silently failing, so local development still works end to end.
/// </summary>
public sealed class SmtpEmailService : IEmailService
{
    private readonly SmtpOptions _smtp;
    private readonly ContactRecipientOptions _recipient;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(
        IOptions<SmtpOptions> smtpOptions,
        IOptions<ContactRecipientOptions> recipientOptions,
        ILogger<SmtpEmailService> logger)
    {
        _smtp = smtpOptions.Value;
        _recipient = recipientOptions.Value;
        _logger = logger;
    }

    public async Task SendContactNotificationAsync(ContactMessage message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_smtp.Host))
        {
            // No email provider configured yet — log so the submission is never silently lost.
            _logger.LogInformation(
                "Contact form submission received (SMTP not configured): {Name} <{Email}> at {ReceivedAtUtc}",
                message.Name, message.Email, message.ReceivedAtUtc);
            return;
        }

        using var mail = new MailMessage
        {
            From = new MailAddress(_smtp.FromAddress, _recipient.DisplayName),
            Subject = $"Portfolio contact form — {message.Name}",
            Body = $"Name: {message.Name}\nEmail: {message.Email}\nReceived: {message.ReceivedAtUtc:u}\n\n{message.Message}",
            IsBodyHtml = false
        };
        mail.To.Add(new MailAddress(_recipient.Email, _recipient.DisplayName));
        mail.ReplyToList.Add(new MailAddress(message.Email, message.Name));

        using var client = new SmtpClient(_smtp.Host, _smtp.Port)
        {
            EnableSsl = _smtp.EnableSsl,
            Credentials = new NetworkCredential(_smtp.Username, _smtp.Password)
        };

        cancellationToken.ThrowIfCancellationRequested();
        await client.SendMailAsync(mail);
    }
}
